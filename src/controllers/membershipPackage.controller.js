const { Package, PackageMembership, Category } = require('../models');
const { Op } = require('sequelize');

// Get all membership packages with pagination and search
const getAllMembershipPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      type: 'membership'
    };
    
    if (search) {
      whereClause.name = {
                    [Op.like]: `%${search}%`
      };
    }

    const { count, rows: packages } = await Package.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PackageMembership,
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
      session: pkg.PackageMembership ? pkg.PackageMembership.session : null,
      category: pkg.PackageMembership && pkg.PackageMembership.Category ? {
        id: pkg.PackageMembership.Category.id,
        name: pkg.PackageMembership.Category.category_name
      } : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
      reminder_day: pkg.reminder_day,
      reminder_session: pkg.reminder_session
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Membership packages retrieved successfully',
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
    console.error('Error getting membership packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get membership package by ID
const getMembershipPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'membership'
      },
      include: [
        {
          model: PackageMembership,
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
        message: 'Membership package not found'
      });
    }

    // Transform data to match form requirements
    const transformedPackage = {
      id: package.id,
      name: package.name,
      price: package.price,
      session: package.PackageMembership ? package.PackageMembership.session : null,
      category: package.PackageMembership && package.PackageMembership.Category ? {
        id: package.PackageMembership.Category.id,
        name: package.PackageMembership.Category.category_name
      } : null,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      reminder_day: package.reminder_day,
      reminder_session: package.reminder_session
    };

    res.json({
      success: true,
      message: 'Membership package retrieved successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error getting membership package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new membership package
const createMembershipPackage = async (req, res) => {
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
        type: 'membership'
      }
    });

    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'Membership package with this name already exists'
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

    // Create membership package
    const newPackage = await Package.create({
      name,
      price: parseFloat(price),
      type: 'membership',
      duration_value: parseInt(duration_value),
      duration_unit,
      reminder_day: reminder_day ? parseInt(reminder_day) : null,
      reminder_session: reminder_session ? parseInt(reminder_session) : null
    });

    // Create package membership
    await PackageMembership.create({
      package_id: newPackage.id,
      session: parseInt(session),
      category_id
    });

    // Fetch the created package with associations
    const createdPackage = await Package.findByPk(newPackage.id, {
      include: [
        {
          model: PackageMembership,
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
      session: createdPackage.PackageMembership ? createdPackage.PackageMembership.session : null,
      category: createdPackage.PackageMembership && createdPackage.PackageMembership.Category ? {
        id: createdPackage.PackageMembership.Category.id,
        name: createdPackage.PackageMembership.Category.category_name
      } : null,
      duration_value: createdPackage.duration_value,
      duration_unit: createdPackage.duration_unit,
      reminder_day: createdPackage.reminder_day,
      reminder_session: createdPackage.reminder_session
    };

    res.status(201).json({
      success: true,
      message: 'Membership package created successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error creating membership package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update membership package
const updateMembershipPackage = async (req, res) => {
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
        type: 'membership'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Membership package not found'
      });
    }

    // Check if package with same name exists (excluding current package)
    if (name && name !== package.name) {
      const existingPackage = await Package.findOne({
        where: { 
          name,
          type: 'membership',
          id: { [Op.ne]: id }
        }
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Membership package with this name already exists'
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

    // Update package membership
    if (session && category_id) {
      const existingMembership = await PackageMembership.findOne({
        where: { package_id: package.id }
      });
      if (existingMembership) {
        await existingMembership.update({
          session: parseInt(session),
          category_id
        });
      } else {
        await PackageMembership.create({
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
          model: PackageMembership,
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
      session: updatedPackage.PackageMembership ? updatedPackage.PackageMembership.session : null,
      category: updatedPackage.PackageMembership && updatedPackage.PackageMembership.Category ? {
        id: updatedPackage.PackageMembership.Category.id,
        name: updatedPackage.PackageMembership.Category.category_name
      } : null,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
      reminder_day: updatedPackage.reminder_day,
      reminder_session: updatedPackage.reminder_session
    };

    res.json({
      success: true,
      message: 'Membership package updated successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error updating membership package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete membership package
const deleteMembershipPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'membership'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Membership package not found'
      });
    }

    // Check if package is being used in orders
    const orderCount = await package.countOrders();
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete membership package that is being used in orders'
      });
    }

    // Delete package (this will also delete related package_membership due to CASCADE)
    await package.destroy();

    res.json({
      success: true,
      message: 'Membership package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting membership package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all categories for membership package creation/update
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['category_name', 'ASC']]
    });

    // Transform categories to simple format
    const transformedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.category_name
    }));

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: transformedCategories
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllMembershipPackages,
  getMembershipPackageById,
  createMembershipPackage,
  updateMembershipPackage,
  deleteMembershipPackage,
  getCategories
}; 