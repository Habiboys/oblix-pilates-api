const express = require('express');
const router = express.Router();
const trialPackageController = require('../controllers/trialPackage.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createTrialPackageSchema,
  updateTrialPackageSchema,
  trialPackageIdSchema,
  trialPackageQuerySchema
} = require('../validations/trialPackage.validation');

// Get all trial packages (public)
router.get('/',
  validate(trialPackageQuerySchema, 'query'),
  trialPackageController.getAllTrialPackages
);

// Get trial package by ID (public)
router.get('/:id',
  validate(trialPackageIdSchema, 'params'),
  trialPackageController.getTrialPackageById
);

// Create new trial package (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createTrialPackageSchema, 'body'),
  trialPackageController.createTrialPackage
);

// Update trial package (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(trialPackageIdSchema, 'params'),
  validate(updateTrialPackageSchema, 'body'),
  trialPackageController.updateTrialPackage
);

// Delete trial package (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(trialPackageIdSchema, 'params'),
  trialPackageController.deleteTrialPackage
);

module.exports = router; 