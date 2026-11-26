const Household = require('../models/Household');
const User = require('../models/User');
const Item = require('../models/Item');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Create a new household
const createHousehold = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const household = await Household.create({
    name,
    owner: req.user._id,
    members: [
      {
        user: req.user._id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
  });

  // Attach household to user's households list
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { households: household._id },
  });

  const populated = await Household.findById(household._id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');

  return ApiResponse.created(res, { household: populated }, 'Household created');
});

// Get user's households
const getHouseholds = asyncHandler(async (req, res) => {
  const households = await Household.find({
    'members.user': req.user._id,
  })
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');

  return ApiResponse.success(res, { households }, 'Households retrieved');
});

// Join household using invite code
const joinByCode = asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;

  const household = await Household.findOne({
    inviteCode: inviteCode.trim().toUpperCase(),
  });

  if (!household) {
    throw ApiError.notFound('Invalid invite code');
  }

  const alreadyMember = household.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );

  if (alreadyMember) {
    throw ApiError.conflict('You are already a member of this household');
  }

  household.members.push({
    user: req.user._id,
    role: 'member',
    joinedAt: new Date(),
  });

  await household.save();

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { households: household._id },
  });

  const populated = await Household.findById(household._id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');

  return ApiResponse.success(res, { household: populated }, 'Joined household successfully');
});

// Invite member by email
const inviteMember = asyncHandler(async (req, res) => {
  const { householdId } = req.params;
  const { email } = req.body;

  const household = await Household.findById(householdId);
  if (!household) {
    throw ApiError.notFound('Household not found');
  }

  // Check if current user is member
  const isMember = household.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) {
    throw ApiError.forbidden('You are not a member of this household');
  }

  const invitee = await User.findOne({ email: email.toLowerCase() });
  if (!invitee) {
    throw ApiError.notFound('No user found with that email address');
  }

  const alreadyMember = household.members.some(
    (m) => m.user.toString() === invitee._id.toString()
  );
  if (alreadyMember) {
    throw ApiError.conflict('User is already a member of this household');
  }

  household.members.push({
    user: invitee._id,
    role: 'member',
    joinedAt: new Date(),
  });

  await household.save();

  await User.findByIdAndUpdate(invitee._id, {
    $addToSet: { households: household._id },
  });

  const populated = await Household.findById(household._id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');

  return ApiResponse.success(
    res,
    { household: populated },
    `Added ${invitee.name} to the household`
  );
});

// Get household items
const getHouseholdItems = asyncHandler(async (req, res) => {
  const { householdId } = req.params;

  const isMember = await Household.exists({
    _id: householdId,
    'members.user': req.user._id,
  });

  if (!isMember) {
    throw ApiError.forbidden('You are not a member of this household');
  }

  const items = await Item.find({ householdId, status: 'active' })
    .sort({ expiryDate: 1 })
    .populate('userId', 'name email avatar');

  return ApiResponse.success(res, { items }, 'Household items retrieved');
});

module.exports = {
  createHousehold,
  getHouseholds,
  joinByCode,
  inviteMember,
  getHouseholdItems,
};
