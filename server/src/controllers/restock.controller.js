const RestockItem = require('../models/RestockItem');
const Item = require('../models/Item');
const Household = require('../models/Household');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { inferItemMetadata, computeSmartExpiryDate } = require('../utils/haulParser');

const getAccessibleRestockFilter = async (userId) => {
  const userHouseholds = await Household.find({
    'members.user': userId,
  }).select('_id');
  const householdIds = userHouseholds.map((h) => h._id);

  return {
    $or: [{ userId }, { householdId: { $in: householdIds } }],
  };
};

const canAccessRestockItem = async (userId, restockItem) => {
  if (restockItem.userId.toString() === userId.toString()) return true;
  if (restockItem.householdId) {
    return Boolean(
      await Household.exists({
        _id: restockItem.householdId,
        'members.user': userId,
      })
    );
  }
  return false;
};

// GET /api/restock
const getRestockItems = asyncHandler(async (req, res) => {
  const filter = await getAccessibleRestockFilter(req.user._id);
  const items = await RestockItem.find(filter)
    .sort({ isChecked: 1, createdAt: -1 })
    .populate('householdId', 'name');

  return ApiResponse.success(
    res,
    { items, count: items.length },
    'Restock list retrieved'
  );
});

// POST /api/restock
const addRestockItem = asyncHandler(async (req, res) => {
  const { name, category, location, quantity, unit, price, source, householdId } =
    req.body;

  if (householdId) {
    const isMember = await Household.exists({
      _id: householdId,
      'members.user': req.user._id,
    });
    if (!isMember) {
      throw ApiError.forbidden('You are not a member of this household');
    }
  }

  const inferred = inferItemMetadata(name);

  // Avoid creating duplicate unchecked entries for the same item name
  const existingFilter = await getAccessibleRestockFilter(req.user._id);
  const duplicate = await RestockItem.findOne({
    ...existingFilter,
    isChecked: false,
    name: { $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });

  if (duplicate) {
    duplicate.quantity = Number((duplicate.quantity + (quantity || 1)).toFixed(2));
    if (price !== undefined && price !== null) {
      duplicate.price = Number(price);
    }
    await duplicate.save();
    return ApiResponse.success(
      res,
      { item: duplicate },
      'Updated existing restock item quantity'
    );
  }

  const item = await RestockItem.create({
    name: name.trim(),
    category: category || inferred.category,
    location: location || inferred.location,
    quantity: quantity || 1,
    unit: unit || 'pcs',
    price: price !== undefined && price !== null ? Number(price) : null,
    source: source || 'manual',
    userId: req.user._id,
    householdId: householdId || null,
  });

  return ApiResponse.created(res, { item }, 'Added to restock list');
});

// PATCH /api/restock/:id
const updateRestockItem = asyncHandler(async (req, res) => {
  const item = await RestockItem.findById(req.params.id);
  if (!item) {
    throw ApiError.notFound('Restock item not found');
  }

  if (!(await canAccessRestockItem(req.user._id, item))) {
    throw ApiError.forbidden('You do not have access to this restock item');
  }

  const { name, isChecked, quantity, unit, price, category, location } = req.body;
  if (name !== undefined) item.name = name.trim();
  if (isChecked !== undefined) item.isChecked = isChecked;
  if (quantity !== undefined) item.quantity = quantity;
  if (unit !== undefined) item.unit = unit;
  if (price !== undefined) item.price = price;
  if (category !== undefined) item.category = category;
  if (location !== undefined) item.location = location;

  await item.save();
  return ApiResponse.success(res, { item }, 'Restock item updated');
});

// DELETE /api/restock/:id
const deleteRestockItem = asyncHandler(async (req, res) => {
  const item = await RestockItem.findById(req.params.id);
  if (!item) {
    throw ApiError.notFound('Restock item not found');
  }

  if (!(await canAccessRestockItem(req.user._id, item))) {
    throw ApiError.forbidden('You do not have access to this restock item');
  }

  await RestockItem.findByIdAndDelete(req.params.id);
  return ApiResponse.success(res, null, 'Restock item removed');
});

// POST /api/restock/stock-bought
// Converts all checked (bought) restock items into active kitchen inventory items
const stockBoughtItems = asyncHandler(async (req, res) => {
  const filter = await getAccessibleRestockFilter(req.user._id);
  const boughtItems = await RestockItem.find({
    ...filter,
    isChecked: true,
  });

  if (boughtItems.length === 0) {
    return ApiResponse.success(
      res,
      { stockedItems: [], count: 0 },
      'No checked items to move to kitchen'
    );
  }

  const docsToCreate = boughtItems.map((r) => ({
    name: r.name,
    category: r.category || 'other',
    location: r.location || 'fridge',
    quantity: r.quantity || 1,
    unit: r.unit || 'pcs',
    price: r.price ?? null,
    expiryDate: computeSmartExpiryDate(r.category, r.location),
    userId: req.user._id,
    householdId: r.householdId || null,
    status: 'active',
  }));

  const createdItems = await Item.insertMany(docsToCreate);
  await RestockItem.deleteMany({
    _id: { $in: boughtItems.map((b) => b._id) },
  });

  return ApiResponse.created(
    res,
    { stockedItems: createdItems, count: createdItems.length },
    `Moved ${createdItems.length} item(s) to Your Kitchen`
  );
});

module.exports = {
  getRestockItems,
  addRestockItem,
  updateRestockItem,
  deleteRestockItem,
  stockBoughtItems,
};
