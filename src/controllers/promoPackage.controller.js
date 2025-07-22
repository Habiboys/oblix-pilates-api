const { Package, PackagePromo, Category } = require('../models');
const { Op } = require('sequelize');

// Get all promo packages with pagination and search
const getAllPromoPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      type: 'promo'
    };
    
    if (search) {
      whereClause.name = {
        [Op.iLike]: `%${search}%`
      };
    }

    const { count, rows: packages } = await Package.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PackagePromo,
          include: [
            {
              model: Category
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform data to match form requirements
    const transformedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      session: pkg.PackagePromo ? pkg.PackagePromo.session : null,
      category: pkg.PackagePromo && pkg.PackagePromo.Category ? {
        id: pkg.PackagePromo.Category.id,
        name: pkg.PackagePromo.Category.category_name
      } : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
      reminder_day: pkg.reminder_day,
      reminder_session: pkg.reminder_session
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Promo packages retrieved successfully',
      data: {
        packages: transformedPackages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting promo packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get promo package by ID
const getPromoPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'promo'
      },
      include: [
        {
          model: PackagePromo,
          include: [
            {
              model: Category
            }
          ]
        }
      ]
    });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Promo package not found'
      });
    }

    // Transform data to match form requirements
    const transformedPackage = {
      id: package.id,
      name: package.name,
      price: package.price,
      session: package.PackagePromo ? package.PackagePromo.session : null,
      category: package.PackagePromo && package.PackagePromo.Category ? {
        id: package.PackagePromo.Category.id,
        name: package.PackagePromo.Category.category_name
      } : null,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      reminder_day: package.reminder_day,
      reminder_session: package.reminder_session
    };

    res.json({
      success: true,
      message: 'Promo package retrieved successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error getting promo package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new promo package
const createPromoPackage = async (req, res) => {
  try {
    const {
      name,
      price,
      duration_value,
      duration_unit,
      reminder_day,
      reminder_session,
      session,
      category_id
    } = req.body;

    // Check if package with same name exists
    const existingPackage = await Package.findOne({
      where: { 
        name,
        type: 'promo'
      }
    });

    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'Promo package with this name already exists'
      });
    }

    // Validate category exists
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Create promo package
    const newPackage = await Package.create({
      name,
      price: parseFloat(price),
      type: 'promo',
      duration_value: parseInt(duration_value),
      duration_unit,
      reminder_day: reminder_day ? parseInt(reminder_day) : null,
      reminder_session: reminder_session ? parseInt(reminder_session) : null
    });

    // Create package promo
    await PackagePromo.create({
      package_id: newPackage.id,
      session: parseInt(session),
      category_id
    });

    // Fetch the created package with associations
    const createdPackage = await Package.findByPk(newPackage.id, {
      include: [
        {
          model: PackagePromo,
          include: [
            {
              model: Category
            }
          ]
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: createdPackage.id,
      name: createdPackage.name,
      price: createdPackage.price,
      session: createdPackage.PackagePromo ? createdPackage.PackagePromo.session : null,
      category: createdPackage.PackagePromo && createdPackage.PackagePromo.Category ? {
        id: createdPackage.PackagePromo.Category.id,
        name: createdPackage.PackagePromo.Category.category_name
      } : null,
      duration_value: createdPackage.duration_value,
      duration_unit: createdPackage.duration_unit,
      reminder_day: createdPackage.reminder_day,
      reminder_session: createdPackage.reminder_session
    };

    res.status(201).json({
      success: true,
      message: 'Promo package created successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error creating promo package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update promo package
const updatePromoPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      duration_value,
      duration_unit,
      reminder_day,
      reminder_session,
      session,
      category_id
    } = req.body;

    const package = await Package.findOne({
      where: {
        id,
        type: 'promo'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Promo package not found'
      });
    }

    // Check if package with same name exists (excluding current package)
    if (name && name !== package.name) {
      const existingPackage = await Package.findOne({
        where: { 
          name,
          type: 'promo',
          id: { [Op.ne]: id }
        }
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Promo package with this name already exists'
        });
      }
    }

    // Validate category exists if provided
    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category not found'
        });
      }
    }

    // Update package
    await package.update({
      name: name || package.name,
      price: price ? parseFloat(price) : package.price,
      duration_value: duration_value ? parseInt(duration_value) : package.duration_value,
      duration_unit: duration_unit || package.duration_unit,
      reminder_day: reminder_day !== undefined ? (reminder_day ? parseInt(reminder_day) : null) : package.reminder_day,
      reminder_session: reminder_session !== undefined ? (reminder_session ? parseInt(reminder_session) : null) : package.reminder_session
    });

    // Update package promo
    if (session && category_id) {
      const existingPromo = await PackagePromo.findOne({
        where: { package_id: package.id }
      });
      if (existingPromo) {
        await existingPromo.update({
          session: parseInt(session),
          category_id
        });
      } else {
        await PackagePromo.create({
          package_id: package.id,
          session: parseInt(session),
          category_id
        });
      }
    }

    // Fetch the updated package with associations
    const updatedPackage = await Package.findByPk(id, {
      include: [
        {
          model: PackagePromo,
          include: [
            {
              model: Category
            }
          ]
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: updatedPackage.id,
      name: updatedPackage.name,
      price: updatedPackage.price,
      session: updatedPackage.PackagePromo ? updatedPackage.PackagePromo.session : null,
      category: updatedPackage.PackagePromo && updatedPackage.PackagePromo.Category ? {
        id: updatedPackage.PackagePromo.Category.id,
        name: updatedPackage.PackagePromo.Category.category_name
      } : null,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
      reminder_day: updatedPackage.reminder_day,
      reminder_session: updatedPackage.reminder_session
    };

    res.json({
      success: true,
      message: 'Promo package updated successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error updating promo package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete promo package
const deletePromoPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'promo'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Promo package not found'
      });
    }

    // Check if package is being used in orders
    const orderCount = await package.countOrders();
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete promo package that is being used in orders'
      });
    }

    // Delete package (this will also delete related package_promo due to CASCADE)
    await package.destroy();

    res.json({
      success: true,
      message: 'Promo package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promo package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllPromoPackages,
  getPromoPackageById,
  createPromoPackage,
  updatePromoPackage,
  deletePromoPackage
}; 