const { Category } = require('../models');
const { Op } = require('sequelize');

// Get all categories with pagination and search
const getAllCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause.category_name = {
        [Op.iLike]: `%${search}%`
      };
    }

    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['category_name', 'ASC']]
    });

    // Transform data to simple format
    const transformedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.category_name,
      description: cat.description
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: transformedCategories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Transform data to simple format
    const transformedCategory = {
      id: category.id,
      name: category.category_name,
      description: category.description
    };

    res.json({
      success: true,
      message: 'Category retrieved successfully',
      data: transformedCategory
    });
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new category
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category with same name exists
    const existingCategory = await Category.findOne({
      where: { category_name: name }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // Create category
    const newCategory = await Category.create({
      category_name: name,
      description: description || null
    });

    // Transform data to simple format
    const transformedCategory = {
      id: newCategory.id,
      name: newCategory.category_name,
      description: newCategory.description
    };

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: transformedCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = await Category.findByPk(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category with same name exists (excluding current category)
    if (name && name !== category.category_name) {
      const existingCategory = await Category.findOne({
        where: { 
          category_name: name,
          id: { [Op.ne]: id }
        }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Update category
    await category.update({
      category_name: name || category.category_name,
      description: description !== undefined ? description : category.description
    });

    // Transform data to simple format
    const transformedCategory = {
      id: category.id,
      name: category.category_name,
      description: category.description
    };

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: transformedCategory
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category is being used in packages
    const packageCount = await category.countPackages();
    if (packageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that is being used in packages'
      });
    }

    // Delete category
    await category.destroy();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
}; 