const express = require('express');
const router = express.Router();
const { register, login, refreshToken } = require('../controllers/auth.controller');
const { validateToken } = require('../middlewares/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', validateToken, refreshToken);

module.exports = router;