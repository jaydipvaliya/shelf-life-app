const CATEGORY_RULES = [
  {
    category: 'frozen',
    location: 'freezer',
    defaultDays: 120,
    keywords: ['frozen', 'ice cream', 'popsicle', 'gelato', 'fries', 'nugget', 'sorbet'],
  },
  {
    category: 'dairy',
    location: 'fridge',
    defaultDays: 7,
    keywords: [
      'milk',
      'yogurt',
      'yoghurt',
      'cheese',
      'butter',
      'cream',
      'egg',
      'eggs',
      'paneer',
      'curd',
      'kefir',
      'mozzarella',
      'cheddar',
    ],
  },
  {
    category: 'meat',
    location: 'fridge',
    defaultDays: 3,
    keywords: [
      'chicken',
      'beef',
      'pork',
      'fish',
      'salmon',
      'shrimp',
      'prawn',
      'turkey',
      'bacon',
      'sausage',
      'mutton',
      'lamb',
      'steak',
      'tuna',
    ],
  },
  {
    category: 'produce',
    location: 'fridge',
    defaultDays: 6,
    keywords: [
      'spinach',
      'lettuce',
      'kale',
      'tomato',
      'banana',
      'apple',
      'avocado',
      'berry',
      'berries',
      'strawberry',
      'blueberry',
      'blackberry',
      'pepper',
      'carrot',
      'cucumber',
      'broccoli',
      'cauliflower',
      'onion',
      'potato',
      'garlic',
      'lemon',
      'lime',
      'orange',
      'grape',
      'mango',
      'cilantro',
      'parsley',
      'mushroom',
      'zucchini',
      'celery',
    ],
  },
  {
    category: 'bakery',
    location: 'pantry',
    defaultDays: 5,
    keywords: [
      'bread',
      'sourdough',
      'bagel',
      'bun',
      'buns',
      'croissant',
      'tortilla',
      'muffin',
      'pastry',
      'baguette',
      'toast',
      'pita',
      'naan',
    ],
  },
  {
    category: 'beverages',
    location: 'fridge',
    defaultDays: 14,
    keywords: [
      'juice',
      'soda',
      'coffee',
      'tea',
      'kombucha',
      'smoothie',
      'lemonade',
      'cola',
      'sparkling',
      'water',
    ],
  },
  {
    category: 'snacks',
    location: 'pantry',
    defaultDays: 30,
    keywords: [
      'chip',
      'chips',
      'cookie',
      'cookies',
      'chocolate',
      'cracker',
      'biscuit',
      'pretzel',
      'popcorn',
      'candy',
      'granola bar',
      'nuts',
      'almond',
      'cashew',
    ],
  },
  {
    category: 'pantry',
    location: 'pantry',
    defaultDays: 90,
    keywords: [
      'rice',
      'pasta',
      'spaghetti',
      'noodle',
      'oats',
      'oatmeal',
      'flour',
      'sugar',
      'honey',
      'oil',
      'olive oil',
      'beans',
      'lentil',
      'chickpea',
      'sauce',
      'ketchup',
      'mustard',
      'mayo',
      'cereal',
      'jam',
      'peanut butter',
      'vinegar',
      'salt',
      'spice',
      'broth',
    ],
  },
];

const SUPPORTED_UNITS = new Set([
  'pcs',
  'g',
  'kg',
  'ml',
  'l',
  'pack',
  'box',
  'bottle',
  'can',
  'oz',
  'lb',
]);

const UNIT_ALIASES = {
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  bag: 'pack',
  bags: 'pack',
  packs: 'pack',
  pkg: 'pack',
  boxes: 'box',
  bottles: 'bottle',
  btl: 'bottle',
  cans: 'can',
  lbs: 'lb',
  kgs: 'kg',
  gram: 'g',
  grams: 'g',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
};

const RECEIPT_NOISE_REGEX =
  /\b(subtotal|sub-total|sub total|grand total|net total|total|tax|vat|gst|cgst|sgst|igst|gstin|round\s*off|change|balance|cash|visa|mastercard|amex|debit|credit|upi|gpay|phonepe|paytm|receipt|invoice|bill\s*no|thank\s*you|thanks|welcome|store|cashier|register|terminal|qty|rate|amount|amt|discount|savings|member|loyalty|tel|phone|ph:|www\.|\.com|\.in|approved|declined|sale|batch|trace|appr|avs|cvv|cnp|customer\s*copy|merchant\s*copy|manual|auth|ref#?)\b/i;

const inferItemMetadata = (name = '') => {
  const lower = String(name).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return {
        category: rule.category,
        location: rule.location,
        defaultDays: rule.defaultDays,
      };
    }
  }
  return { category: 'other', location: 'fridge', defaultDays: 7 };
};

const computeSmartExpiryDate = (category, location) => {
  const rule = CATEGORY_RULES.find((r) => r.category === category);
  let days = rule?.defaultDays || 7;

  if (location === 'freezer') {
    days = Math.max(days * 3, 90);
  } else if (
    location === 'pantry' &&
    (category === 'produce' || category === 'dairy' || category === 'meat')
  ) {
    days = Math.min(days, 3);
  }

  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const toTitleCase = (str) =>
  str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const parseSingleEntry = (rawEntry, { fromOcr = false } = {}) => {
  let line = rawEntry.trim();
  if (!line || line.length < 3) return null;
  if (RECEIPT_NOISE_REGEX.test(line)) return null;
  // Reject lines with OCR noise symbols like pipes, brackets, semicolons, quotes
  if (fromOcr && /[|[\]{}~^_=<>;"\\]/.test(line)) return null;
  // Skip pure numbers, dates, times, phone numbers, or symbols
  if (/^[\d\s.,/:$₹€£-]+$/.test(line)) return null;
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line)) return null;
  if (/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(line)) return null;

  // Strip common receipt SKU/barcode prefixes or trailing tax indicator flags (F, T, N, *)
  line = line.replace(/\b\d{6,14}\b/g, ' ').replace(/\s+[FTNA*]{1,2}$/, '').trim();

  let price = null;
  // Extract currency-prefixed price like $4.50, ₹120, €3.20, £2, Rs 50, INR 150
  const currencyPriceMatch = line.match(
    /(?:[$₹€£]|rs\.?|inr|usd)\s*(\d+(?:\.\d{1,2})?)/i
  );
  if (currencyPriceMatch) {
    price = parseFloat(currencyPriceMatch[1]);
    line = line.replace(currencyPriceMatch[0], ' ');
  } else {
    // Extract trailing decimal price like "Baby Spinach 3.99" or "Milk 120.00"
    const trailingPriceMatch = line.match(/\s+(\d+\.\d{2})\s*[A-Z*]?$/);
    if (trailingPriceMatch) {
      price = parseFloat(trailingPriceMatch[1]);
      line = line.slice(0, trailingPriceMatch.index);
    } else {
      // Handle receipt columns with integer price at far right separated by 2+ spaces: "SOURDOUGH BREAD   65"
      const spacedIntPrice = line.match(/\s{2,}(\d{1,5})$/);
      if (spacedIntPrice) {
        price = parseFloat(spacedIntPrice[1]);
        line = line.slice(0, spacedIntPrice.index);
      }
    }
  }

  // Handle "2 @ 1.50" quantity/unit-price pattern inside receipt lines
  line = line.replace(/\b\d+\s*@\s*\d+(?:\.\d{1,2})?/g, ' ').trim();

  let quantity = 1;
  let unit = 'pcs';

  // Leading quantity + optional unit: "2x milk", "2 bottles water", "500g chicken"
  const leadingQtyUnit = line.match(
    /^(\d+(?:\.\d+)?)\s*(x|pcs|pc|pieces?|g|grams?|kg|kgs|ml|l|liters?|litres?|pack|packs|bag|bags|box|boxes|bottle|bottles|can|cans|oz|lb|lbs)?\s+(.+)$/i
  );
  if (leadingQtyUnit) {
    const qtyVal = parseFloat(leadingQtyUnit[1]);
    const rawUnit = (leadingQtyUnit[2] || '').toLowerCase();
    const rest = leadingQtyUnit[3].trim();
    if (rest.length >= 2 && qtyVal > 0 && qtyVal < 5000) {
      quantity = qtyVal;
      if (rawUnit && rawUnit !== 'x') {
        const mapped = UNIT_ALIASES[rawUnit] || rawUnit;
        if (SUPPORTED_UNITS.has(mapped)) unit = mapped;
      }
      line = rest;
    }
  } else {
    // Inline attached metric unit like "chicken breast 500g" or "milk 2l"
    const inlineUnitMatch = line.match(
      /\b(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|pcs|pack|box|bottle|can)\b/i
    );
    if (inlineUnitMatch) {
      const qtyVal = parseFloat(inlineUnitMatch[1]);
      const rawUnit = inlineUnitMatch[2].toLowerCase();
      const mapped = UNIT_ALIASES[rawUnit] || rawUnit;
      if (qtyVal > 0 && SUPPORTED_UNITS.has(mapped)) {
        quantity = qtyVal;
        unit = mapped;
        line = line.replace(inlineUnitMatch[0], ' ');
      }
    }
  }

  // Strip stray leading bullet/dash/multiplier symbols
  line = line.replace(/^[-*•]+\s*/, '').replace(/\s{2,}/g, ' ').trim();
  if (!line || line.length < 3 || /^\d+$/.test(line)) return null;

  const lettersOnly = line.replace(/[^a-zA-Z]/g, '');
  const nonSpaceChars = line.replace(/\s+/g, '');
  if (lettersOnly.length < 3) return null;
  if (nonSpaceChars.length > 0 && lettersOnly.length / nonSpaceChars.length < 0.6) {
    return null;
  }

  const cleanName = toTitleCase(line.slice(0, 100));
  const { category, location } = inferItemMetadata(cleanName);

  // For noisy raw OCR lines, require either a recognized food category OR a valid price
  if (fromOcr) {
    const words = cleanName.split(/\s+/);
    const hasLongWord = words.some((w) => w.replace(/[^a-zA-Z]/g, '').length >= 4);
    const mostlyShortCaps =
      words.length >= 3 &&
      words.filter((w) => w.length <= 2).length >= Math.ceil(words.length / 2);

    if (!hasLongWord || mostlyShortCaps) return null;
    if (category === 'other' && price === null) return null;
  }

  const expiryDate = computeSmartExpiryDate(category, location).toISOString();

  return {
    name: cleanName,
    category,
    location,
    quantity,
    unit,
    price,
    expiryDate,
  };
};

const parseGroceryHaulText = (rawText = '', options = {}) => {
  if (!rawText || typeof rawText !== 'string') return [];

  // Split by newlines or commas (when not inside numbers like 1,000)
  const segments = rawText
    .split(/\r?\n|,(?!\d{3}\b)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = [];
  for (const seg of segments) {
    const item = parseSingleEntry(seg, options);
    if (item) parsed.push(item);
  }

  return parsed.slice(0, 50);
};

module.exports = {
  inferItemMetadata,
  computeSmartExpiryDate,
  parseGroceryHaulText,
};
