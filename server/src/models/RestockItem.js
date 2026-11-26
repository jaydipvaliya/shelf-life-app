const mongoose = require('mongoose');

const restockItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
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
      enum: ['fridge', 'freezer', 'pantry'],
      default: 'fridge',
    },
    quantity: {
      type: Number,
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
    isChecked: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ['manual', 'consumed', 'discarded', 'recipe'],
      default: 'manual',
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
  }
);

restockItemSchema.index({ userId: 1, isChecked: 1, createdAt: -1 });

const RestockItem = mongoose.model('RestockItem', restockItemSchema);
module.exports = RestockItem;
