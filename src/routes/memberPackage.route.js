const express = require('express');
const router = express.Router();
const { getMyPackages } = require('../controllers/memberPackage.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');

// Get user's packages
router.get('/my-packages', validateToken, checkRole('user'), getMyPackages);

module.exports = router; 