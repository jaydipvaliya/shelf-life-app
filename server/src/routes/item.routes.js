const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const {
  createItem,
  createItemsBatch,
  parseGroceryHaul,
  scanReceiptBill,
  getItems,
  getExpiringSoon,
  getItemById,
  updateItem,
  deleteItem,
} = require('../controllers/item.controller');
const verifyJWT = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const ApiError = require('../utils/apiError');

const router = express.Router();

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only image files are allowed for receipt scanning'), false);
    }
  },
});

// Validation schemas
const createItemSchema = {
  body: z.object({
    name: z.string().min(1, 'Item name is required'),
    category: z.enum([
      'dairy',
      'produce',
      'meat',
      'bakery',
      'pantry',
      'frozen',
      'beverages',
      'snacks',
      'other',
    ]),
    location: z.enum(['fridge', 'freezer', 'pantry']),
    quantity: z.number().positive('Quantity must be greater than 0').default(1),
    unit: z.enum(['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'can', 'oz', 'lb']).default('pcs'),
    price: z.number().min(0, 'Price cannot be negative').nullable().optional(),
    expiryDate: z.string().or(z.date()),
    photoUrl: z.string().optional(),
    barcode: z.string().optional(),
    notes: z.string().max(500).optional(),
    householdId: z.string().nullable().optional(),
  }),
};

const updateItemSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    category: z
      .enum([
        'dairy',
        'produce',
        'meat',
        'bakery',
        'pantry',
        'frozen',
        'beverages',
        'snacks',
        'other',
      ])
      .optional(),
    location: z.enum(['fridge', 'freezer', 'pantry']).optional(),
    quantity: z.number().positive().optional(),
    unit: z.enum(['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'can', 'oz', 'lb']).optional(),
    price: z.number().min(0, 'Price cannot be negative').nullable().optional(),
    expiryDate: z.string().or(z.date()).optional(),
    photoUrl: z.string().optional(),
    barcode: z.string().optional(),
    notes: z.string().max(500).optional(),
    status: z.enum(['active', 'consumed', 'discarded', 'expired']).optional(),
    householdId: z.string().nullable().optional(),
  }),
};

const parseHaulSchema = {
  body: z.object({
    text: z.string().min(1, 'Please enter grocery items or receipt text').max(8000),
  }),
};

const batchCreateSchema = {
  body: z.object({
    householdId: z.string().nullable().optional(),
    items: z
      .array(createItemSchema.body)
      .min(1, 'At least one item is required')
      .max(50, 'Maximum 50 items per batch'),
  }),
};

// Protect all item routes
router.use(verifyJWT);

router.post('/', validate(createItemSchema), createItem);
router.post('/parse-haul', validate(parseHaulSchema), parseGroceryHaul);
router.post('/scan-receipt', receiptUpload.single('receipt'), scanReceiptBill);
router.post('/batch', validate(batchCreateSchema), createItemsBatch);
router.get('/', getItems);
router.get('/expiring-soon', getExpiringSoon);
router.get('/:id', getItemById);
router.patch('/:id', validate(updateItemSchema), updateItem);
router.delete('/:id', deleteItem);

module.exports = router;
