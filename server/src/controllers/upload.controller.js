const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only image files are allowed'), false);
    }
  },
});

const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No image file provided in request');
  }

  let finalUrl = '';

  if (isCloudinaryConfigured()) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'shelflife/items',
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
      });
      finalUrl = result.secure_url;

      // Clean up local temp file
      fs.unlink(req.file.path, () => {});
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError.message);
      // Fallback to local file URL
      const host = req.get('host');
      const protocol = req.protocol;
      finalUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }
  } else {
    // Local storage URL
    const host = req.get('host');
    const protocol = req.protocol;
    finalUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  }

  return ApiResponse.success(
    res,
    {
      url: finalUrl,
      filename: req.file.filename,
      size: req.file.size,
    },
    'Photo uploaded successfully'
  );
});

module.exports = {
  upload,
  uploadPhoto,
};
