const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');

// Report routes (require admin authentication)
router.get('/revenue', validateToken, checkRole('admin'), reportController.getRevenueReport);
router.get('/payroll', validateToken, checkRole('admin'), reportController.getPayrollReport);
router.get('/payroll/:instructor_id', validateToken, checkRole('admin'), reportController.getPayrollDetail);

module.exports = router; 