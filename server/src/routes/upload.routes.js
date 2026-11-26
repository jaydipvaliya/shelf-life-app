const express = require('express');
const { upload, uploadPhoto } = require('../controllers/upload.controller');
const verifyJWT = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verifyJWT);
router.post('/photo', upload.single('photo'), uploadPhoto);

module.exports = router;
