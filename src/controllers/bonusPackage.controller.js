const { Package, PackageBonus, Category, Member } = require('../models');
const { Op } = require('sequelize');

// Get all bonus packages with pagination and search
const getAllBonusPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      type: 'bonus'
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
          model: PackageBonus,
          include: [
            {
              model: Category
            },
            {
              model: Member,
              as: 'member'
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
      session: pkg.PackageBonus ? pkg.PackageBonus.session : null,
      category: pkg.PackageBonus && pkg.PackageBonus.Category ? {
        id: pkg.PackageBonus.Category.id,
        name: pkg.PackageBonus.Category.category_name
      } : null,
      member: pkg.PackageBonus && pkg.PackageBonus.member ? {
        id: pkg.PackageBonus.member.id,
        name: pkg.PackageBonus.member.full_name
      } : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
      reminder_day: pkg.reminder_day,
      reminder_session: pkg.reminder_session
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Bonus packages retrieved successfully',
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
    console.error('Error getting bonus packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get bonus package by ID
const getBonusPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'bonus'
      },
      include: [
        {
          model: PackageBonus,
          include: [
            {
              model: Category
            },
            {
              model: Member,
              as: 'member'
            }
          ]
        }
      ]
    });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Bonus package not found'
      });
    }

    // Transform data to match form requirements
    const transformedPackage = {
      id: package.id,
      name: package.name,
      price: package.price,
      session: package.PackageBonus ? package.PackageBonus.session : null,
      category: package.PackageBonus && package.PackageBonus.Category ? {
        id: package.PackageBonus.Category.id,
        name: package.PackageBonus.Category.category_name
      } : null,
      member: package.PackageBonus && package.PackageBonus.member ? {
        id: package.PackageBonus.member.id,
        name: package.PackageBonus.member.full_name
      } : null,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      reminder_day: package.reminder_day,
      reminder_session: package.reminder_session
    };

    res.json({
      success: true,
      message: 'Bonus package retrieved successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error getting bonus package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new bonus package
const createBonusPackage = async (req, res) => {
  try {
    const {
      name,
      price,
      duration_value,
      duration_unit,
      reminder_day,
      reminder_session,
      session,
      category_id,
      member_id
    } = req.body;

    // Check if package with same name exists
    const existingPackage = await Package.findOne({
      where: { 
        name,
        type: 'bonus'
      }
    });

    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'Bonus package with this name already exists'
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

    // Validate member exists
    const member = await Member.findByPk(member_id);
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Create bonus package
    const newPackage = await Package.create({
      name,
      price: parseFloat(price),
      type: 'bonus',
      duration_value: parseInt(duration_value),
      duration_unit,
      reminder_day: reminder_day ? parseInt(reminder_day) : null,
      reminder_session: reminder_session ? parseInt(reminder_session) : null
    });

    // Create package bonus
    await PackageBonus.create({
      package_id: newPackage.id,
      session: parseInt(session),
      category_id,
      member_id
    });

    // Fetch the created package with associations
    const createdPackage = await Package.findByPk(newPackage.id, {
      include: [
        {
          model: PackageBonus,
          include: [
            {
              model: Category
            },
            {
              model: Member,
              as: 'member'
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
      session: createdPackage.PackageBonus ? createdPackage.PackageBonus.session : null,
      category: createdPackage.PackageBonus && createdPackage.PackageBonus.Category ? {
        id: createdPackage.PackageBonus.Category.id,
        name: createdPackage.PackageBonus.Category.category_name
      } : null,
      member: createdPackage.PackageBonus && createdPackage.PackageBonus.member ? {
        id: createdPackage.PackageBonus.member.id,
        name: createdPackage.PackageBonus.member.full_name
      } : null,
      duration_value: createdPackage.duration_value,
      duration_unit: createdPackage.duration_unit,
      reminder_day: createdPackage.reminder_day,
      reminder_session: createdPackage.reminder_session
    };

    res.status(201).json({
      success: true,
      message: 'Bonus package created successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error creating bonus package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update bonus package
const updateBonusPackage = async (req, res) => {
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
      category_id,
      member_id
    } = req.body;

    const package = await Package.findOne({
      where: {
        id,
        type: 'bonus'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Bonus package not found'
      });
    }

    // Check if package with same name exists (excluding current package)
    if (name && name !== package.name) {
      const existingPackage = await Package.findOne({
        where: { 
          name,
          type: 'bonus',
          id: { [Op.ne]: id }
        }
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Bonus package with this name already exists'
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

    // Validate member exists if provided
    if (member_id) {
      const member = await Member.findByPk(member_id);
      if (!member) {
        return res.status(400).json({
          success: false,
          message: 'Member not found'
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

    // Update package bonus
    if (session && category_id && member_id) {
      const existingBonus = await PackageBonus.findOne({
        where: { package_id: package.id }
      });
      if (existingBonus) {
        await existingBonus.update({
          session: parseInt(session),
          category_id,
          member_id
        });
      } else {
        await PackageBonus.create({
          package_id: package.id,
          session: parseInt(session),
          category_id,
          member_id
        });
      }
    }

    // Fetch the updated package with associations
    const updatedPackage = await Package.findByPk(id, {
      include: [
        {
          model: PackageBonus,
          include: [
            {
              model: Category
            },
            {
              model: Member,
              as: 'member'
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
      session: updatedPackage.PackageBonus ? updatedPackage.PackageBonus.session : null,
      category: updatedPackage.PackageBonus && updatedPackage.PackageBonus.Category ? {
        id: updatedPackage.PackageBonus.Category.id,
        name: updatedPackage.PackageBonus.Category.category_name
      } : null,
      member: updatedPackage.PackageBonus && updatedPackage.PackageBonus.member ? {
        id: updatedPackage.PackageBonus.member.id,
        name: updatedPackage.PackageBonus.member.full_name
      } : null,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
      reminder_day: updatedPackage.reminder_day,
      reminder_session: updatedPackage.reminder_session
    };

    res.json({
      success: true,
      message: 'Bonus package updated successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error updating bonus package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete bonus package
const deleteBonusPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'bonus'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Bonus package not found'
      });
    }

    // Check if package is being used in orders
    const orderCount = await package.countOrders();
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete bonus package that is being used in orders'
      });
    }

    // Delete package (this will also delete related package_bonus due to CASCADE)
    await package.destroy();

    res.json({
      success: true,
      message: 'Bonus package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bonus package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Search members for bonus package
const searchMembers = async (req, res) => {
  try {
    const { search = '' } = req.query;

    const whereClause = {};
    if (search) {
      whereClause.full_name = {
        [Op.iLike]: `%${search}%`
      };
    }

    const members = await Member.findAll({
      where: whereClause,
      limit: 10,
      order: [['full_name', 'ASC']]
    });

    // Transform data to simple format
    const transformedMembers = members.map(member => ({
      id: member.id,
      name: member.full_name,
      email: member.email
    }));

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: transformedMembers
    });
  } catch (error) {
    console.error('Error searching members:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllBonusPackages,
  getBonusPackageById,
  createBonusPackage,
  updateBonusPackage,
  deleteBonusPackage,
  searchMembers
}; 