const express = require('express');
const router = express.Router();
const { register, login, refreshToken, forgotPassword, resetPassword, checkPurchaseStatus, checkTokenStatus } = require('../controllers/auth.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 
    registerSchema, 
    loginSchema, 
    forgotPasswordSchema, 
    resetPasswordSchema 
} = require('../validations/auth.validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token',  refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/purchase-status', validateToken, checkPurchaseStatus);
router.get('/token-status', validateToken, checkTokenStatus);

module.exports = router;