const ApiError = require('../utils/apiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Multer upload errors cleanly
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded image exceeds the 10MB size limit'
        : err.message;
    error = new ApiError(status, message);
  }

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ApiError(400, 'Invalid JSON payload');
  }

  // Handle Mongoose CastError / ObjectId error
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    error = new ApiError(404, message);
  }

  // Handle Mongoose Duplicate Key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = new ApiError(409, message);
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ApiError(400, message);
  }

  const statusCode = error.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    statusCode >= 500 && isProd
      ? 'Internal Server Error'
      : error.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  const response = {
    success: false,
    message,
    statusCode,
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
