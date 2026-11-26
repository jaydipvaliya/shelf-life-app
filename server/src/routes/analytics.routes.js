const express = require('express');
const { getAnalyticsSummary } = require('../controllers/analytics.controller');
const verifyJWT = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verifyJWT);
router.get('/summary', getAnalyticsSummary);

module.exports = router;
