const validateEnv = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = requiredVars.filter(
    (name) => !process.env[name] || process.env[name].trim() === ''
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variable(s): ${missing.join(', ')}`
    );
  }

  if (process.env.JWT_SECRET.trim().length < 32 || process.env.JWT_REFRESH_SECRET.trim().length < 32) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters in production');
  }

  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '') {
    console.warn('⚠️ [Env] CORS_ORIGIN is empty in production; browser cross-origin requests will be rejected.');
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME.trim() === '') {
    console.warn('⚠️ [Env] CLOUDINARY_CLOUD_NAME is not set; uploaded photos will fall back to local disk.');
  }

  if (!process.env.ADMIN_JOB_SECRET || process.env.ADMIN_JOB_SECRET.trim() === '') {
    console.warn('⚠️ [Env] ADMIN_JOB_SECRET is not set; /api/jobs/trigger-expiry-check will deny requests.');
  }
};

const getJwtSecret = () => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '') {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'shelflife_secret_jwt_key';
};

const getJwtRefreshSecret = () => {
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.trim() !== '') {
    return process.env.JWT_REFRESH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }
  return 'shelflife_secret_refresh_key';
};

module.exports = {
  validateEnv,
  getJwtSecret,
  getJwtRefreshSecret,
};
