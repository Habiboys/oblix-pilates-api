const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');

// Dashboard routes (require admin authentication)
router.get('/', validateToken, checkRole('admin'), dashboardController.getDashboardData);
router.get('/metrics', validateToken, checkRole('admin'), dashboardController.getDashboardMetrics);
router.get('/today-classes', validateToken, checkRole('admin'), dashboardController.getTodayClasses);

module.exports = router; 