const fs = require('fs');
const path = require('path');
const Item = require('../models/Item');
const Household = require('../models/Household');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { parseGroceryHaulText } = require('../utils/haulParser');
const { extractTextFromImageBuffer } = require('../services/ocr.service');
const {
  isAIConfigured,
  scanReceiptWithAI,
  parseHaulWithAI,
} = require('../services/aiReceipt.service');

// Helper to check user access to an item or household
const getAccessibleFilter = async (userId, householdId = null) => {
  if (householdId) {
    // Verify user is member of this household
    const household = await Household.findOne({
      _id: householdId,
      'members.user': userId,
    });
    if (!household) {
      throw ApiError.forbidden('You are not a member of this household');
    }
    return { householdId };
  }

  // Find user's households
  const userHouseholds = await Household.find({
    'members.user': userId,
  }).select('_id');
  const householdIds = userHouseholds.map((h) => h._id);

  // Return items owned by user OR shared in user's households
  return {
    $or: [{ userId }, { householdId: { $in: householdIds } }],
  };
};

// Create a new item
const createItem = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    location,
    quantity,
    unit,
    price,
    expiryDate,
    photoUrl,
    barcode,
    notes,
    householdId,
  } = req.body;

  if (householdId) {
    const isMember = await Household.exists({
      _id: householdId,
      'members.user': req.user._id,
    });
    if (!isMember) {
      throw ApiError.forbidden('You are not a member of this household');
    }
  }

  const item = await Item.create({
    name,
    category,
    location,
    quantity: quantity || 1,
    unit: unit || 'pcs',
    price: price !== undefined && price !== null ? Number(price) : null,
    expiryDate: new Date(expiryDate),
    photoUrl: photoUrl || '',
    barcode: barcode || '',
    notes: notes || '',
    userId: req.user._id,
    householdId: householdId || null,
    status: 'active',
  });

  return ApiResponse.created(res, { item }, 'Item added successfully');
});

// Get all items with filters and bounded pagination
const getItems = asyncHandler(async (req, res) => {
  const { location, category, status, search, householdId, sort, page, limit } = req.query;

  const baseFilter = await getAccessibleFilter(req.user._id, householdId);
  const filter = { ...baseFilter };

  if (location && location !== 'all') {
    filter.location = location;
  }

  if (category && category !== 'all') {
    filter.category = category;
  }

  if (status && status !== 'all') {
    filter.status = status;
  } else if (!status) {
    // Default to active items unless a specific status or "all" is requested
    filter.status = 'active';
  }

  if (search && search.trim() !== '') {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escapedSearch, $options: 'i' };
  }

  let sortOptions = { expiryDate: 1 }; // Default: closest to expiry first
  if (sort === 'newest') sortOptions = { createdAt: -1 };
  if (sort === 'oldest') sortOptions = { createdAt: 1 };
  if (sort === 'name') sortOptions = { name: 1 };

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 200);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const [items, total] = await Promise.all([
    Item.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .populate('userId', 'name email avatar')
      .populate('householdId', 'name'),
    Item.countDocuments(filter),
  ]);

  return ApiResponse.success(
    res,
    {
      items,
      count: items.length,
      total,
      page: parsedPage,
      hasMore: skip + items.length < total,
    },
    'Items retrieved'
  );
});

// Get items expiring soon (e.g. within N days)
const getExpiringSoon = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 3;
  const { householdId } = req.query;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const targetDate = new Date(startOfToday);
  targetDate.setDate(targetDate.getDate() + days);
  targetDate.setHours(23, 59, 59, 999);

  const baseFilter = await getAccessibleFilter(req.user._id, householdId);

  const items = await Item.find({
    ...baseFilter,
    status: 'active',
    expiryDate: {
      $lte: targetDate,
    },
  })
    .sort({ expiryDate: 1 })
    .populate('userId', 'name email avatar');

  return ApiResponse.success(
    res,
    {
      items,
      count: items.length,
      daysThreshold: days,
    },
    'Expiring items retrieved'
  );
});

// Get single item by ID
const getItemById = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id)
    .populate('userId', 'name email avatar')
    .populate('householdId', 'name');

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  // Check access permission
  const isOwner = item.userId._id.toString() === req.user._id.toString();
  let isHouseholdMember = false;
  if (item.householdId) {
    isHouseholdMember = await Household.exists({
      _id: item.householdId._id,
      'members.user': req.user._id,
    });
  }

  if (!isOwner && !isHouseholdMember) {
    throw ApiError.forbidden('You do not have access to this item');
  }

  return ApiResponse.success(res, { item }, 'Item details retrieved');
});

// Update item (fields or status: consumed, discarded, active)
const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  const isOwner = item.userId.toString() === req.user._id.toString();
  let isHouseholdMember = false;
  if (item.householdId) {
    isHouseholdMember = await Household.exists({
      _id: item.householdId,
      'members.user': req.user._id,
    });
  }

  if (!isOwner && !isHouseholdMember) {
    throw ApiError.forbidden('You cannot update this item');
  }

  const {
    name,
    category,
    location,
    quantity,
    unit,
    price,
    expiryDate,
    photoUrl,
    barcode,
    notes,
    status,
    householdId,
  } = req.body;

  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (location !== undefined) item.location = location;
  if (quantity !== undefined) item.quantity = quantity;
  if (unit !== undefined) item.unit = unit;
  if (price !== undefined) item.price = price;
  if (expiryDate !== undefined) item.expiryDate = new Date(expiryDate);
  if (photoUrl !== undefined) item.photoUrl = photoUrl;
  if (barcode !== undefined) item.barcode = barcode;
  if (notes !== undefined) item.notes = notes;
  if (householdId !== undefined) {
    if (householdId) {
      const targetMember = await Household.exists({
        _id: householdId,
        'members.user': req.user._id,
      });
      if (!targetMember) {
        throw ApiError.forbidden('You are not a member of the target household');
      }
      item.householdId = householdId;
    } else {
      item.householdId = null;
    }
  }

  if (status !== undefined && status !== item.status) {
    item.status = status;
    item.statusChangedAt = new Date();
  }

  await item.save();

  return ApiResponse.success(res, { item }, 'Item updated successfully');
});

// Delete item
const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  const isOwner = item.userId.toString() === req.user._id.toString();
  let isHouseholdMember = false;
  if (item.householdId) {
    isHouseholdMember = await Household.exists({
      _id: item.householdId,
      'members.user': req.user._id,
    });
  }

  if (!isOwner && !isHouseholdMember) {
    throw ApiError.forbidden('You cannot delete this item');
  }

  await Item.findByIdAndDelete(req.params.id);

  // Clean up unreferenced local upload files when an item is deleted
  if (item.photoUrl && item.photoUrl.includes('/uploads/')) {
    const filename = path.basename(item.photoUrl.split('?')[0]);
    if (filename && /^item-\d+-\d+\.[a-z0-9]+$/i.test(filename)) {
      const otherRef = await Item.exists({ photoUrl: { $regex: filename } });
      if (!otherRef) {
        const localFile = path.join(__dirname, '../../uploads', filename);
        fs.unlink(localFile, () => {});
      }
    }
  }

  return ApiResponse.success(res, null, 'Item deleted successfully');
});

// Parse freeform grocery haul or pasted receipt text into structured item drafts
const parseGroceryHaul = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (isAIConfigured()) {
    try {
      const aiResult = await parseHaulWithAI(text);
      if (aiResult) {
        return ApiResponse.success(
          res,
          {
            items: aiResult.items,
            count: aiResult.items.length,
            usedAI: true,
            provider: aiResult.provider,
          },
          `AI parsed ${aiResult.items.length} grocery item(s)`
        );
      }
    } catch (err) {
      console.warn('⚠️ [AI Haul] Falling back to local parser:', err.message);
    }
  }

  const items = parseGroceryHaulText(text);

  return ApiResponse.success(
    res,
    { items, count: items.length, usedAI: false },
    `Parsed ${items.length} grocery item(s)`
  );
});

// Scan an uploaded shop bill/receipt photo using AI Vision (with strict OCR fallback)
const scanReceiptBill = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No receipt image provided');
  }

  const aiEnabled = isAIConfigured();

  if (aiEnabled) {
    try {
      const aiResult = await scanReceiptWithAI(
        req.file.buffer,
        req.file.mimetype || 'image/jpeg'
      );
      if (aiResult) {
        return ApiResponse.success(
          res,
          {
            rawText: '',
            items: aiResult.items,
            count: aiResult.items.length,
            usedAI: true,
            provider: aiResult.provider,
            aiConfigured: true,
          },
          `AI scanned receipt and extracted ${aiResult.items.length} food item(s)`
        );
      }
    } catch (err) {
      console.warn('⚠️ [AI Receipt] Falling back to Tesseract OCR:', err.message);
    }
  }

  const rawText = await extractTextFromImageBuffer(req.file.buffer);
  const items = parseGroceryHaulText(rawText, { fromOcr: true });

  return ApiResponse.success(
    res,
    {
      rawText: rawText.trim(),
      items,
      count: items.length,
      usedAI: false,
      aiConfigured: aiEnabled,
    },
    `Scanned receipt and extracted ${items.length} item(s)`
  );
});

// Create multiple food items in a single batch (from Quick Haul or Receipt Importer)
const createItemsBatch = asyncHandler(async (req, res) => {
  const { items, householdId } = req.body;

  if (householdId) {
    const isMember = await Household.exists({
      _id: householdId,
      'members.user': req.user._id,
    });
    if (!isMember) {
      throw ApiError.forbidden('You are not a member of this household');
    }
  }

  const docs = items.map((entry) => ({
    name: entry.name.trim(),
    category: entry.category || 'other',
    location: entry.location || 'fridge',
    quantity: entry.quantity || 1,
    unit: entry.unit || 'pcs',
    price: entry.price !== undefined && entry.price !== null ? Number(entry.price) : null,
    expiryDate: new Date(entry.expiryDate),
    photoUrl: entry.photoUrl || '',
    barcode: entry.barcode || '',
    notes: entry.notes || '',
    userId: req.user._id,
    householdId: entry.householdId !== undefined ? entry.householdId : householdId || null,
    status: 'active',
  }));

  const created = await Item.insertMany(docs);

  return ApiResponse.created(
    res,
    { items: created, count: created.length },
    `Added ${created.length} item(s) to kitchen`
  );
});

module.exports = {
  createItem,
  createItemsBatch,
  parseGroceryHaul,
  scanReceiptBill,
  getItems,
  getExpiringSoon,
  getItemById,
  updateItem,
  deleteItem,
};
