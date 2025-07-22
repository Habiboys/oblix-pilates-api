const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createStaffSchema,
  updateStaffSchema,
  staffIdSchema,
  staffQuerySchema
} = require('../validations/staff.validation');

// Get all staff (admin only)
router.get('/',
  validateToken,
  checkRole('admin'),
  validate(staffQuerySchema, 'query'),
  staffController.getAllStaff
);

// Get staff by ID (admin only)
router.get('/:id',
  validateToken,
  checkRole('admin'),
  validate(staffIdSchema, 'params'),
  staffController.getStaffById
);

// Create new staff (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createStaffSchema, 'body'),
  staffController.createStaff
);

// Update staff (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(staffIdSchema, 'params'),
  validate(updateStaffSchema, 'body'),
  staffController.updateStaff
);

// Delete staff (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(staffIdSchema, 'params'),
  staffController.deleteStaff
);

module.exports = router; 