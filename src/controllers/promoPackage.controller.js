const { Package, PackagePromo, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get all promo packages with pagination and search
const getAllPromoPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', active_only = 'false' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      type: 'promo'
    };
    
    if (search) {
      whereClause.name = {
        [Op.like]: `%${search}%`
      };
    }

    // Build include clause based on active_only parameter and user role
    const includeClause = [
      {
        model: PackagePromo,
        required: true
      }
    ];

    // Admin can see all packages, non-admin only see active packages
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin or active_only is explicitly true, filter by promo period
    if (!isAdmin || active_only === 'true') {
      const currentDate = new Date();
      includeClause[0].where = {
        start_time: {
          [Op.lte]: currentDate
        },
        end_time: {
          [Op.gte]: currentDate
        }
      };
    }

    const { count, rows: packages } = await Package.findAndCountAll({
      where: {
        ...whereClause,
        is_deleted: false
      },
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform data to match form requirements
    const transformedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      group_session: pkg.PackagePromo ? pkg.PackagePromo.group_session : null,
      private_session: pkg.PackagePromo ? pkg.PackagePromo.private_session : null,
      start_time: pkg.PackagePromo ? pkg.PackagePromo.start_time : null,
      end_time: pkg.PackagePromo ? pkg.PackagePromo.end_time : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
      reminder_day: pkg.reminder_day,
      reminder_session: pkg.reminder_session
    }));

    const totalPages = Math.ceil(count / limit);

    // Determine message based on user role and filter
    let message = 'Promo packages retrieved successfully';
    if (isAdmin) {
      message = active_only === 'true' 
        ? 'Active promo packages retrieved successfully (Admin view)' 
        : 'All promo packages retrieved successfully (Admin view)';
    } else {
      message = 'Active promo packages retrieved successfully';
    }

    res.json({
      success: true,
      message,
      data: {
        packages: transformedPackages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filter: {
          active_only: active_only === 'true',
          user_role: isAdmin ? 'admin' : 'user'
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
    const currentDate = new Date();

    const package = await Package.findOne({
      where: {
        id,
        type: 'promo',
        is_deleted: false
      },
      include: [
        {
          model: PackagePromo,
          where: {
            start_time: {
              [Op.lte]: currentDate
            },
            end_time: {
              [Op.gte]: currentDate
            }
          },
          required: true
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
      group_session: package.PackagePromo ? package.PackagePromo.group_session : 0,
      private_session: package.PackagePromo ? package.PackagePromo.private_session : 0,
      start_time: package.PackagePromo ? package.PackagePromo.start_time : null,
      end_time: package.PackagePromo ? package.PackagePromo.end_time : null,
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
  const t = await sequelize.transaction();
  try {
    const {
      name,
      price,
      duration_value,
      duration_unit,
      reminder_day,
      reminder_session,
      group_session,
      private_session,
      start_time,
      end_time,
    } = req.body;

    // Check if package with same name exists
    const existingPackage = await Package.findOne({
      where: { 
        name,
        type: 'promo',
        is_deleted: false
      },
      transaction: t
    });

    if (existingPackage) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Promo package with this name already exists'
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
      reminder_session: reminder_session ? parseInt(reminder_session) : null,
    }, { transaction: t });

    // Create package promo
    await PackagePromo.create({
      package_id: newPackage.id,
      group_session: group_session !== undefined && group_session !== null ? parseInt(group_session) : 0,
      private_session: private_session !== undefined && private_session !== null ? parseInt(private_session) : 0,
      start_time,
      end_time
    }, { transaction: t });

    await t.commit();

    // Fetch the created package with associations
    const createdPackage = await Package.findByPk(newPackage.id, {
      include: [
        {
          model: PackagePromo
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: createdPackage.id,
      name: createdPackage.name,
      price: createdPackage.price,
      group_session: createdPackage.PackagePromo ? createdPackage.PackagePromo.group_session : 0,
      private_session: createdPackage.PackagePromo ? createdPackage.PackagePromo.private_session : 0,
      start_time: createdPackage.PackagePromo ? createdPackage.PackagePromo.start_time : null,
      end_time: createdPackage.PackagePromo ? createdPackage.PackagePromo.end_time : null,
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
    await t.rollback();
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
      group_session,
      private_session,
      start_time,
      end_time
    } = req.body;

    const package = await Package.findOne({
      where: {
        id,
        type: 'promo',
        is_deleted: false
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
          id: { [Op.ne]: id },
          is_deleted: false
        }
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Promo package with this name already exists'
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
      reminder_session: reminder_session !== undefined ? (reminder_session ? parseInt(reminder_session) : null) : package.reminder_session,
    });
    const packagePromo = await PackagePromo.findOne({
      where: { package_id: package.id }
    });
    if (packagePromo) {
      await packagePromo.update({
        group_session: group_session !== undefined ? parseInt(group_session) : packagePromo.group_session,
        private_session: private_session !== undefined ? parseInt(private_session) : packagePromo.private_session,
        start_time: start_time || packagePromo.start_time,
        end_time: end_time || packagePromo.end_time
      });
    }


    // Fetch the updated package with associations
    const updatedPackage = await Package.findByPk(id, {
      include: [
        {
          model: PackagePromo
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: updatedPackage.id,
      name: updatedPackage.name,
      price: updatedPackage.price,
      group_session: updatedPackage.PackagePromo ? updatedPackage.PackagePromo.group_session : 0,
      private_session: updatedPackage.PackagePromo ? updatedPackage.PackagePromo.private_session : 0,
      start_time: updatedPackage.PackagePromo ? updatedPackage.PackagePromo.start_time : null,
      end_time: updatedPackage.PackagePromo ? updatedPackage.PackagePromo.end_time : null,
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
        type: 'promo',
        is_deleted: false
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

    // Soft delete package (set is_deleted = true)
    await package.update({ is_deleted: true });

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