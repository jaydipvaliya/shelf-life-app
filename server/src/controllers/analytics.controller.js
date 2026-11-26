const Item = require('../models/Item');
const Household = require('../models/Household');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const ESTIMATED_ITEM_VALUE = 4.5;
const ESTIMATED_ITEM_WEIGHT_KG = 0.45;

const resolveItemValue = (item) =>
  typeof item?.price === 'number' && item.price >= 0
    ? item.price
    : ESTIMATED_ITEM_VALUE;

const getDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const userHouseholds = await Household.find({
    'members.user': userId,
  }).select('_id');
  const householdIds = userHouseholds.map((h) => h._id);

  const scopeMatch = {
    $or: [{ userId }, { householdId: { $in: householdIds } }],
  };

  // Aggregate items by status
  const statusStats = await Item.aggregate([
    { $match: scopeMatch },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = {
    active: 0,
    consumed: 0,
    discarded: 0,
    expired: 0,
  };

  statusStats.forEach((s) => {
    if (counts[s._id] !== undefined) {
      counts[s._id] = s.count;
    }
  });

  const totalFinished = counts.consumed + counts.discarded;
  const savedRate =
    totalFinished > 0 ? Math.round((counts.consumed / totalFinished) * 100) : 100;
  const foodSavedKg = Number((counts.consumed * ESTIMATED_ITEM_WEIGHT_KG).toFixed(1));

  // Category breakdown
  const categoryStats = await Item.aggregate([
    { $match: scopeMatch },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        consumed: {
          $sum: { $cond: [{ $eq: ['$status', 'consumed'] }, 1, 0] },
        },
        discarded: {
          $sum: { $cond: [{ $eq: ['$status', 'discarded'] }, 1, 0] },
        },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Location breakdown
  const locationStats = await Item.aggregate([
    { $match: { ...scopeMatch, status: 'active' } },
    {
      $group: {
        _id: '$location',
        count: { $sum: 1 },
      },
    },
  ]);

  const locationCounts = {
    fridge: 0,
    freezer: 0,
    pantry: 0,
  };
  locationStats.forEach((loc) => {
    if (locationCounts[loc._id] !== undefined) {
      locationCounts[loc._id] = loc.count;
    }
  });

  // Expiring soon (3 days) & At risk this week (7 days)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const threeDaysEnd = new Date(startOfToday);
  threeDaysEnd.setDate(threeDaysEnd.getDate() + 3);
  threeDaysEnd.setHours(23, 59, 59, 999);

  const sevenDaysEnd = new Date(startOfToday);
  sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);
  sevenDaysEnd.setHours(23, 59, 59, 999);

  const lookbackStart = new Date(startOfToday);
  lookbackStart.setDate(lookbackStart.getDate() - 365);

  const [expiringSoonCount, atRiskItems, finishedItems] = await Promise.all([
    Item.countDocuments({
      ...scopeMatch,
      status: 'active',
      expiryDate: { $lte: threeDaysEnd },
    }),
    Item.find({
      ...scopeMatch,
      status: 'active',
      expiryDate: { $lte: sevenDaysEnd },
    }).select('price'),
    Item.find({
      ...scopeMatch,
      status: { $in: ['consumed', 'discarded'] },
      $or: [
        { statusChangedAt: { $gte: lookbackStart } },
        { statusChangedAt: null, updatedAt: { $gte: lookbackStart } },
      ],
    }).select('status price statusChangedAt updatedAt createdAt'),
  ]);

  const atRiskWeekCount = atRiskItems.length;
  const atRiskValue = Math.round(
    atRiskItems.reduce((sum, item) => sum + resolveItemValue(item), 0)
  );

  // Weekly savings (W1..W5 ending with current week as W5)
  const weeklyBuckets = [0, 0, 0, 0, 0];
  let estimatedMoneySaved = 0;
  let currentMonthSaved = 0;
  let previousMonthSaved = 0;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonth = prevMonthDate.getMonth();
  const prevYear = prevMonthDate.getFullYear();

  const discardedDays = new Set();
  let earliestActivity = null;

  for (const item of finishedItems) {
    const eventDate = new Date(item.statusChangedAt || item.updatedAt || item.createdAt);
    if (!earliestActivity || eventDate < earliestActivity) {
      earliestActivity = eventDate;
    }

    if (item.status === 'discarded') {
      discardedDays.add(getDayKey(eventDate));
      continue;
    }

    const itemVal = resolveItemValue(item);
    estimatedMoneySaved += itemVal;

    // Consumed item savings
    const diffDays = Math.floor(
      (startOfToday.getTime() -
        new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays >= 0 && diffDays < 35) {
      const weekFromNow = Math.floor(diffDays / 7); // 0 = W5 (this week), 4 = W1
      const bucketIdx = 4 - weekFromNow;
      if (bucketIdx >= 0 && bucketIdx <= 4) {
        weeklyBuckets[bucketIdx] += itemVal;
      }
    }

    if (eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth) {
      currentMonthSaved += itemVal;
    } else if (eventDate.getFullYear() === prevYear && eventDate.getMonth() === prevMonth) {
      previousMonthSaved += itemVal;
    }
  }

  estimatedMoneySaved = Number(estimatedMoneySaved.toFixed(2));

  const weeklySavings = weeklyBuckets.map((amount, idx) => ({
    label: `W${idx + 1}`,
    amount: Math.round(amount),
    isCurrent: idx === 4,
  }));

  let deltaPercent = 0;
  if (previousMonthSaved > 0) {
    deltaPercent = Math.round(
      ((currentMonthSaved - previousMonthSaved) / previousMonthSaved) * 100
    );
  } else if (currentMonthSaved > 0) {
    deltaPercent = 100;
  }

  // Zero-waste streak: consecutive days ending today with no discarded item
  let currentStreakDays = 0;
  if (counts.consumed > 0 || counts.active > 0) {
    const startRef = earliestActivity || req.user.createdAt || now;
    const maxLookback = Math.min(
      Math.max(
        1,
        Math.ceil(
          (startOfToday.getTime() -
            new Date(
              startRef.getFullYear(),
              startRef.getMonth(),
              startRef.getDate()
            ).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      ),
      365
    );

    for (let i = 0; i < maxLookback; i++) {
      const checkDate = new Date(startOfToday);
      checkDate.setDate(checkDate.getDate() - i);
      if (discardedDays.has(getDayKey(checkDate))) {
        break;
      }
      currentStreakDays++;
    }
  }

  return ApiResponse.success(
    res,
    {
      counts,
      totalTracked: counts.active + counts.consumed + counts.discarded,
      savedRate,
      estimatedMoneySaved,
      foodSavedKg,
      currentStreakDays,
      expiringSoonCount,
      atRiskWeekCount,
      atRiskValue,
      monthlySavings: {
        currentMonthSaved: Math.round(currentMonthSaved),
        previousMonthSaved: Math.round(previousMonthSaved),
        deltaPercent,
      },
      weeklySavings,
      categoryStats,
      locationCounts,
    },
    'Analytics summary retrieved'
  );
});

module.exports = {
  getAnalyticsSummary,
};
