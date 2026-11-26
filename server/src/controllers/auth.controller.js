const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Item = require('../models/Item');
const RestockItem = require('../models/RestockItem');
const Household = require('../models/Household');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getJwtRefreshSecret } = require('../config/env');

// Register a new user
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.addRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  const userObj = user.toJSON();

  return ApiResponse.created(
    res,
    {
      user: userObj,
      accessToken,
      refreshToken,
    },
    'Account created successfully'
  );
});

// Login existing user (supports multiple simultaneous devices up to session limit)
const login = asyncHandler(async (req, res) => {
  const { email, password, expoPushToken } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshTokens');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.addRefreshToken(refreshToken);
  if (expoPushToken) {
    user.expoPushToken = expoPushToken;
  }
  await user.save({ validateBeforeSave: false });

  const userObj = user.toJSON();

  return ApiResponse.success(
    res,
    {
      user: userObj,
      accessToken,
      refreshToken,
    },
    'Login successful'
  );
});

// Refresh access token (rotates the matching device session token)
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: incomingToken } = req.body;

  if (!incomingToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, getJwtRefreshSecret());
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.hasRefreshToken(incomingToken)) {
    throw ApiError.unauthorized('Refresh token is expired or revoked');
  }

  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.rotateRefreshToken(incomingToken, newRefreshToken);
  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(
    res,
    {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
    'Tokens refreshed successfully'
  );
});

// Logout current device session (or all sessions if no refreshToken supplied)
const logout = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.body?.refreshToken;
  const user = await User.findById(req.user._id).select('+refreshTokens');
  if (user) {
    user.removeRefreshToken(incomingRefreshToken || null);
    await user.save({ validateBeforeSave: false });
  }

  return ApiResponse.success(res, null, 'Logged out successfully');
});

// Change password for authenticated user & revoke older refresh sessions
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password +refreshTokens');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isCurrentValid = await user.comparePassword(currentPassword);
  if (!isCurrentValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must be different from your current password');
  }

  user.password = newPassword;
  const accessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();
  user.refreshTokens = [];
  user.addRefreshToken(newRefreshToken);
  await user.save();

  return ApiResponse.success(
    res,
    {
      accessToken,
      refreshToken: newRefreshToken,
    },
    'Password updated successfully'
  );
});

// Get current user profile
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('households');
  return ApiResponse.success(res, { user }, 'User profile retrieved');
});

// Update profile / notification preferences / push token
const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar, notificationPreferences, expoPushToken } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (avatar !== undefined) updates.avatar = avatar;
  if (expoPushToken !== undefined) updates.expoPushToken = expoPushToken;
  if (notificationPreferences) {
    updates.notificationPreferences = {
      ...req.user.notificationPreferences?.toObject(),
      ...notificationPreferences,
    };
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return ApiResponse.success(res, { user }, 'Profile updated successfully');
});

// Delete current user account and associated personal data
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Delete households owned by the user and detach any remaining items from them
  const ownedHouseholds = await Household.find({ owner: userId }).select('_id');
  const ownedIds = ownedHouseholds.map((h) => h._id);
  if (ownedIds.length > 0) {
    await Item.updateMany({ householdId: { $in: ownedIds } }, { $set: { householdId: null } });
    await User.updateMany({ households: { $in: ownedIds } }, { $pull: { households: { $in: ownedIds } } });
    await Household.deleteMany({ _id: { $in: ownedIds } });
  }

  // Remove user from any other households they joined
  await Household.updateMany(
    { 'members.user': userId },
    { $pull: { members: { user: userId } } }
  );

  // Delete all food/restock items owned by this user and the user account itself
  await Item.deleteMany({ userId });
  await RestockItem.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  return ApiResponse.success(res, null, 'Account deleted successfully');
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  changePassword,
  getMe,
  updateProfile,
  deleteAccount,
};
