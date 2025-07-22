const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { validate } = require('../middlewares/validation.middleware');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
  categoryQuerySchema
} = require('../validations/category.validation');

// Get all categories (public)
router.get('/',
  validate(categoryQuerySchema, 'query'),
  categoryController.getAllCategories
);

// Get category by ID (public)
router.get('/:id',
  validate(categoryIdSchema, 'params'),
  categoryController.getCategoryById
);

// Create new category (admin only)
router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createCategorySchema, 'body'),
  categoryController.createCategory
);

// Update category (admin only)
router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(categoryIdSchema, 'params'),
  validate(updateCategorySchema, 'body'),
  categoryController.updateCategory
);

// Delete category (admin only)
router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(categoryIdSchema, 'params'),
  categoryController.deleteCategory
);

module.exports = router; 