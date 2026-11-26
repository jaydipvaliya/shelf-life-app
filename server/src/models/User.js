const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtSecret, getJwtRefreshSecret } = require('../config/env');

const MAX_ACTIVE_SESSIONS = 5;

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    // Multi-device hashed refresh sessions (kept alongside legacy refreshToken removal)
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false,
    },
    expoPushToken: {
      type: String,
      default: null,
    },
    notificationPreferences: {
      reminderDaysBefore: {
        type: [Number],
        default: [1, 3],
      },
      dailyDigestEnabled: {
        type: Boolean,
        default: true,
      },
      alertTime: {
        type: String,
        default: '08:00',
      },
    },
    households: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      name: this.name,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// Generate Refresh Token with unique JTI so rapid logins yield distinct tokens
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      jti: crypto.randomBytes(12).toString('hex'),
    },
    getJwtRefreshSecret(),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    }
  );
};

userSchema.methods.addRefreshToken = function (token) {
  const tokenHash = hashToken(token);
  const current = Array.isArray(this.refreshTokens) ? this.refreshTokens : [];
  const filtered = current.filter((entry) => entry.tokenHash !== tokenHash);
  filtered.push({ tokenHash, createdAt: new Date() });
  this.refreshTokens = filtered.slice(-MAX_ACTIVE_SESSIONS);
};

userSchema.methods.hasRefreshToken = function (token) {
  const tokenHash = hashToken(token);
  const current = Array.isArray(this.refreshTokens) ? this.refreshTokens : [];
  return current.some((entry) => entry.tokenHash === tokenHash);
};

userSchema.methods.rotateRefreshToken = function (oldToken, newToken) {
  const oldHash = hashToken(oldToken);
  const newHash = hashToken(newToken);
  const current = Array.isArray(this.refreshTokens) ? this.refreshTokens : [];
  const next = current.filter((entry) => entry.tokenHash !== oldHash);
  next.push({ tokenHash: newHash, createdAt: new Date() });
  this.refreshTokens = next.slice(-MAX_ACTIVE_SESSIONS);
};

userSchema.methods.removeRefreshToken = function (token) {
  if (!token) {
    this.refreshTokens = [];
    return;
  }
  const tokenHash = hashToken(token);
  const current = Array.isArray(this.refreshTokens) ? this.refreshTokens : [];
  this.refreshTokens = current.filter((entry) => entry.tokenHash !== tokenHash);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
