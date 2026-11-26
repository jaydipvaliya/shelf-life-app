const { inferItemMetadata, computeSmartExpiryDate } = require('../utils/haulParser');

const VALID_CATEGORIES = new Set([
  'dairy',
  'produce',
  'meat',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'other',
]);

const VALID_LOCATIONS = new Set(['fridge', 'freezer', 'pantry']);

const VALID_UNITS = new Set([
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

const isAIConfigured = () =>
  Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') ||
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '')
  );

const normalizeAIItems = (rawItems = []) => {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter((it) => it && typeof it.name === 'string' && it.name.trim().length >= 2)
    .slice(0, 50)
    .map((it) => {
      const cleanName = it.name.trim().slice(0, 100);
      const inferred = inferItemMetadata(cleanName);

      const category = VALID_CATEGORIES.has(it.category)
        ? it.category
        : inferred.category;
      const location = VALID_LOCATIONS.has(it.location)
        ? it.location
        : inferred.location;
      const unit = VALID_UNITS.has(it.unit) ? it.unit : 'pcs';
      const quantity =
        typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1;
      const price =
        typeof it.price === 'number' && it.price >= 0
          ? Number(it.price.toFixed(2))
          : null;

      let expiryDate;
      if (typeof it.expiryDays === 'number' && it.expiryDays > 0 && it.expiryDays <= 730) {
        const d = new Date();
        d.setDate(d.getDate() + Math.round(it.expiryDays));
        expiryDate = d.toISOString();
      } else {
        expiryDate = computeSmartExpiryDate(category, location).toISOString();
      }

      return {
        name: cleanName,
        category,
        location,
        quantity,
        unit,
        price,
        expiryDate,
      };
    });
};

const RECEIPT_PROMPT = `You are a smart kitchen inventory assistant. Inspect this shop bill / receipt and extract ONLY real edible food, beverage, or grocery items purchased.

STRICT RULES:
1. IGNORE all non-food items (hardware, clothing, flooring, electronics) and IGNORE all receipt metadata (store name, address, phone, date, time, invoice/ref/batch/trace numbers, card numbers, approval codes, subtotal, tax/GST, discount, total, amount paid, change, "THANK YOU", "CUSTOMER COPY", "APPROVED").
2. If the image is NOT a food/grocery receipt or contains no food items, return {"items": []}.
3. Expand abbreviated grocery names cleanly (e.g. "ORG BBY SPNCH" -> "Organic Baby Spinach", "WHL MLK 2L" -> "Whole Milk").
4. Return ONLY valid JSON with shape:
{
  "items": [
    {
      "name": "string",
      "category": "dairy|produce|meat|bakery|pantry|frozen|beverages|snacks|other",
      "location": "fridge|freezer|pantry",
      "quantity": 1,
      "unit": "pcs|g|kg|ml|l|pack|box|bottle|can|oz|lb",
      "price": 4.50 or null,
      "expiryDays": 7
    }
  ]
}`;

const callGemini = async (parts) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const candidateModels = Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
      ].filter(Boolean)
    )
  );

  let lastError = null;

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      lastError = new Error(`Gemini API error (${response.status} on ${model}): ${errText}`);
      if ([404, 429, 500, 503].includes(response.status)) {
        continue;
      }
      throw lastError;
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    return normalizeAIItems(parsed.items || []);
  }

  throw lastError || new Error('All Gemini models failed');
};

const callOpenAIVision = async (contentParts) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: contentParts }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.choices?.[0]?.message?.content;
  if (!rawJson) return null;

  const parsed = JSON.parse(rawJson);
  return normalizeAIItems(parsed.items || []);
};

const scanReceiptWithAI = async (imageBuffer, mimeType = 'image/jpeg') => {
  const base64Data = imageBuffer.toString('base64');

  if (process.env.GEMINI_API_KEY?.trim()) {
    const items = await callGemini([
      { text: RECEIPT_PROMPT },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);
    return { items: items || [], provider: 'gemini' };
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const items = await callOpenAIVision([
      { type: 'text', text: RECEIPT_PROMPT },
      {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}` },
      },
    ]);
    return { items: items || [], provider: 'openai' };
  }

  return null;
};

const parseHaulWithAI = async (rawText) => {
  const prompt = `${RECEIPT_PROMPT}\n\nUSER TEXT / RECEIPT LINES:\n${rawText}`;

  if (process.env.GEMINI_API_KEY?.trim()) {
    const items = await callGemini([{ text: prompt }]);
    return { items: items || [], provider: 'gemini' };
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const items = await callOpenAIVision([{ type: 'text', text: prompt }]);
    return { items: items || [], provider: 'openai' };
  }

  return null;
};

module.exports = {
  isAIConfigured,
  scanReceiptWithAI,
  parseHaulWithAI,
};
