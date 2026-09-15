const express = require('express');
const { checkHealth } = require('../controllers/health.controller');

const router = express.Router();

// GET /api/health
router.get('/', checkHealth);

module.exports = router;
