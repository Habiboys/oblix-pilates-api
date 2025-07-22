const express = require('express');
const router = express.Router();
const bonusPackageController = require('../controllers/bonusPackage.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createBonusPackageSchema,
  updateBonusPackageSchema,
  bonusPackageIdSchema,
  bonusPackageQuerySchema,
  memberSearchQuerySchema
} = require('../validations/bonusPackage.validation');

// Get all bonus packages (public)
router.get('/',
  validate(bonusPackageQuerySchema, 'query'),
  bonusPackageController.getAllBonusPackages
);

// Get bonus package by ID (public)
router.get('/:id',
  validate(bonusPackageIdSchema, 'params'),
  bonusPackageController.getBonusPackageById
);

// Search members for bonus package (public)
router.get('/members/search',
  validate(memberSearchQuerySchema, 'query'),
  bonusPackageController.searchMembers
);

// Create new bonus package (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createBonusPackageSchema, 'body'),
  bonusPackageController.createBonusPackage
);

// Update bonus package (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(bonusPackageIdSchema, 'params'),
  validate(updateBonusPackageSchema, 'body'),
  bonusPackageController.updateBonusPackage
);

// Delete bonus package (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(bonusPackageIdSchema, 'params'),
  bonusPackageController.deleteBonusPackage
);

module.exports = router; 