const express = require('express');
const router = express.Router();
const promoPackageController = require('../controllers/promoPackage.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createPromoPackageSchema,
  updatePromoPackageSchema,
  promoPackageIdSchema,
  promoPackageQuerySchema
} = require('../validations/promoPackage.validation');

// Get all promo packages (public)
router.get('/',
  validate(promoPackageQuerySchema, 'query'),
  promoPackageController.getAllPromoPackages
);

// Get promo package by ID (public)
router.get('/:id',
  validate(promoPackageIdSchema, 'params'),
  promoPackageController.getPromoPackageById
);

// Create new promo package (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createPromoPackageSchema, 'body'),
  promoPackageController.createPromoPackage
);

// Update promo package (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(promoPackageIdSchema, 'params'),
  validate(updatePromoPackageSchema, 'body'),
  promoPackageController.updatePromoPackage
);

// Delete promo package (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(promoPackageIdSchema, 'params'),
  promoPackageController.deletePromoPackage
);

module.exports = router; 