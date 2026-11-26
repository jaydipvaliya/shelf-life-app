const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'dairy',
        'produce',
        'meat',
        'bakery',
        'pantry',
        'frozen',
        'beverages',
        'snacks',
        'other',
      ],
      default: 'other',
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      enum: ['fridge', 'freezer', 'pantry'],
      default: 'fridge',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be greater than 0'],
      default: 1,
    },
    unit: {
      type: String,
      enum: ['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'can', 'oz', 'lb'],
      default: 'pcs',
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: null,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['active', 'consumed', 'discarded', 'expired'],
      default: 'active',
      index: true,
    },
    statusChangedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for optimal queries
itemSchema.index({ userId: 1, location: 1, status: 1 });
itemSchema.index({ userId: 1, expiryDate: 1 });
itemSchema.index({ householdId: 1, location: 1, status: 1 });

// Virtual for days until expiry
itemSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.expiryDate) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(this.expiryDate);
  const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const diffTime = startOfExp.getTime() - startOfToday.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for urgency level: safe (> 5 days), warning (3 to 5 days), urgent (0 to 2 days), expired (< 0 days)
itemSchema.virtual('urgency').get(function () {
  if (this.status === 'consumed') return 'consumed';
  if (this.status === 'discarded') return 'discarded';

  const days = this.daysUntilExpiry;
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 2) return 'urgent';
  if (days <= 5) return 'warning';
  return 'safe';
});

const Item = mongoose.model('Item', itemSchema);
module.exports = Item;
