const express = require('express');
const { z } = require('zod');
const {
  createHousehold,
  getHouseholds,
  joinByCode,
  inviteMember,
  getHouseholdItems,
} = require('../controllers/household.controller');
const verifyJWT = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

const createHouseholdSchema = {
  body: z.object({
    name: z.string().min(2, 'Household name must be at least 2 characters'),
  }),
};

const joinByCodeSchema = {
  body: z.object({
    inviteCode: z.string().min(4, 'Invalid invite code'),
  }),
};

const inviteMemberSchema = {
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
  }),
};

// Protect all household routes
router.use(verifyJWT);

router.post('/', validate(createHouseholdSchema), createHousehold);
router.get('/', getHouseholds);
router.post('/join', validate(joinByCodeSchema), joinByCode);
router.post('/:householdId/invite', validate(inviteMemberSchema), inviteMember);
router.get('/:householdId/items', getHouseholdItems);

module.exports = router;
