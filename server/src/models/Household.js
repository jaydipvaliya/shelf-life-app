const mongoose = require('mongoose');
const crypto = require('crypto');

const householdSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Household name is required'],
      trim: true,
      maxlength: [60, 'Household name cannot exceed 60 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'member'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
      uppercase: true,
      default: () => crypto.randomBytes(3).toString('hex').toUpperCase(),
    },
  },
  {
    timestamps: true,
  }
);

const Household = mongoose.model('Household', householdSchema);
module.exports = Household;
