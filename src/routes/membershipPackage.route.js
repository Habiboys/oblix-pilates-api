const express = require('express');
const router = express.Router();
const membershipPackageController = require('../controllers/membershipPackage.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createMembershipPackageSchema,
  updateMembershipPackageSchema,
  membershipPackageIdSchema,
  membershipPackageQuerySchema
} = require('../validations/membershipPackage.validation');

// Get all membership packages (public)
router.get('/',
  validate(membershipPackageQuerySchema, 'query'),
  membershipPackageController.getAllMembershipPackages
);

// Get membership package by ID (public)
router.get('/:id',
  validate(membershipPackageIdSchema, 'params'),
  membershipPackageController.getMembershipPackageById
);

// Get categories for membership package creation/update (admin only)
router.get('/categories/list',
  validateToken,
  checkRole('admin'),
  membershipPackageController.getCategories
);

// Create new membership package (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createMembershipPackageSchema, 'body'),
  membershipPackageController.createMembershipPackage
);

// Update membership package (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(membershipPackageIdSchema, 'params'),
  validate(updateMembershipPackageSchema, 'body'),
  membershipPackageController.updateMembershipPackage
);

// Delete membership package (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(membershipPackageIdSchema, 'params'),
  membershipPackageController.deleteMembershipPackage
);

module.exports = router; 