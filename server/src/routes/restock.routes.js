const express = require('express');
const { z } = require('zod');
const {
  getRestockItems,
  addRestockItem,
  updateRestockItem,
  deleteRestockItem,
  stockBoughtItems,
} = require('../controllers/restock.controller');
const verifyJWT = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

const CATEGORY_ENUM = [
  'dairy',
  'produce',
  'meat',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'other',
];
const LOCATION_ENUM = ['fridge', 'freezer', 'pantry'];
const UNIT_ENUM = ['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'can', 'oz', 'lb'];

const createRestockSchema = {
  body: z.object({
    name: z.string().min(1, 'Item name is required'),
    category: z.enum(CATEGORY_ENUM).optional(),
    location: z.enum(LOCATION_ENUM).optional(),
    quantity: z.number().positive().optional(),
    unit: z.enum(UNIT_ENUM).optional(),
    price: z.number().min(0).nullable().optional(),
    source: z.enum(['manual', 'consumed', 'discarded', 'recipe']).optional(),
    householdId: z.string().nullable().optional(),
  }),
};

const updateRestockSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    isChecked: z.boolean().optional(),
    category: z.enum(CATEGORY_ENUM).optional(),
    location: z.enum(LOCATION_ENUM).optional(),
    quantity: z.number().positive().optional(),
    unit: z.enum(UNIT_ENUM).optional(),
    price: z.number().min(0).nullable().optional(),
  }),
};

router.use(verifyJWT);

router.get('/', getRestockItems);
router.post('/', validate(createRestockSchema), addRestockItem);
router.post('/stock-bought', stockBoughtItems);
router.patch('/:id', validate(updateRestockSchema), updateRestockItem);
router.delete('/:id', deleteRestockItem);

module.exports = router;
