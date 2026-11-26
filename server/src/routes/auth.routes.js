const express = require('express');
const { z } = require('zod');
const {
  register,
  login,
  refreshToken,
  logout,
  changePassword,
  getMe,
  updateProfile,
  deleteAccount,
} = require('../controllers/auth.controller');
const verifyJWT = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Validation schemas
const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
    email: z.string().trim().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Please enter a valid email'),
    password: z.string().min(1, 'Password is required'),
    expoPushToken: z.string().optional(),
  }),
};

const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
  }),
};

const updateProfileSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(60).optional(),
    avatar: z.string().url().or(z.literal('')).optional(),
    expoPushToken: z.string().nullable().optional(),
    notificationPreferences: z
      .object({
        reminderDaysBefore: z.array(z.number().int().min(0).max(30)).optional(),
        dailyDigestEnabled: z.boolean().optional(),
        alertTime: z.string().optional(),
      })
      .optional(),
  }),
};

// Routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token', validate(refreshSchema), refreshToken);
router.post('/logout', verifyJWT, logout);
router.post('/change-password', verifyJWT, validate(changePasswordSchema), changePassword);
router.get('/me', verifyJWT, getMe);
router.patch('/profile', verifyJWT, validate(updateProfileSchema), updateProfile);
router.delete('/account', verifyJWT, deleteAccount);

module.exports = router;
