const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authRateLimiter = require('../middleware/rateLimiter');
const { refreshRateLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

const router = express.Router();

// Public routes
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', refreshRateLimiter, authController.refresh);
router.post('/logout', authController.logout);

// Protected route — requires a valid access token
router.get('/me', authenticate, authController.me);

module.exports = router;
