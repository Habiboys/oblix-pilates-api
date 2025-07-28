const { Package, PackageFirstTrial } = require('../models');
const { Op } = require('sequelize');

// Get all trial packages with pagination and search
const getAllTrialPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      type: 'first_trial'
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
          model: PackageFirstTrial
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
      group_session: pkg.PackageFirstTrial ? pkg.PackageFirstTrial.group_session : null,
      private_session: pkg.PackageFirstTrial ? pkg.PackageFirstTrial.private_session : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
      reminder_day: pkg.reminder_day,
      reminder_session: pkg.reminder_session
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Trial packages retrieved successfully',
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
    console.error('Error getting trial packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get trial package by ID
const getTrialPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'first_trial'
      },
      include: [
        {
          model: PackageFirstTrial
        }
      ]
    });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Trial package not found'
      });
    }

    // Transform data to match form requirements
    const transformedPackage = {
      id: package.id,
      name: package.name,
      price: package.price,
      group_session: package.PackageFirstTrial ? package.PackageFirstTrial.group_session : null,
      private_session: package.PackageFirstTrial ? package.PackageFirstTrial.private_session : null,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      reminder_day: package.reminder_day,
      reminder_session: package.reminder_session
    };

    res.json({
      success: true,
      message: 'Trial package retrieved successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error getting trial package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new trial package
const createTrialPackage = async (req, res) => {
  try {
    const {
      name,
      price,
      duration_value,
      duration_unit,
      reminder_day,
      reminder_session,
      group_session,
      private_session
    } = req.body;

    // Check if package with same name exists
    const existingPackage = await Package.findOne({
      where: { 
        name,
        type: 'first_trial'
      }
    });

    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'Trial package with this name already exists'
      });
    }

    // Create trial package
    const newPackage = await Package.create({
      name,
      price: parseFloat(price),
      type: 'first_trial',
      duration_value: parseInt(duration_value),
      duration_unit,
      reminder_day: reminder_day ? parseInt(reminder_day) : null,
      reminder_session: reminder_session ? parseInt(reminder_session) : null
    });

    // Create package first trial
    await PackageFirstTrial.create({
      package_id: newPackage.id,
      group_session: group_session,
      private_session: private_session
    });

    // Fetch the created package with associations
    const createdPackage = await Package.findByPk(newPackage.id, {
      include: [
        {
          model: PackageFirstTrial
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: createdPackage.id,
      name: createdPackage.name,
      price: createdPackage.price,
      group_session: createdPackage.PackageFirstTrial ? createdPackage.PackageFirstTrial.group_session : null,
      private_session: createdPackage.PackageFirstTrial ? createdPackage.PackageFirstTrial.private_session : null,
      duration_value: createdPackage.duration_value,
      duration_unit: createdPackage.duration_unit,
      reminder_day: createdPackage.reminder_day,
      reminder_session: createdPackage.reminder_session
    };

    res.status(201).json({
      success: true,
      message: 'Trial package created successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error creating trial package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update trial package
const updateTrialPackage = async (req, res) => {
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
      private_session
    } = req.body;

    const package = await Package.findOne({
      where: {
        id,
        type: 'first_trial'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Trial package not found'
      });
    }

    // Check if package with same name exists (excluding current package)
    if (name && name !== package.name) {
      const existingPackage = await Package.findOne({
        where: { 
          name,
          type: 'first_trial',
          id: { [Op.ne]: id }
        }
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Trial package with this name already exists'
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

    // Update package first trial
    if (group_session !== undefined || private_session !== undefined) {
      const existingTrial = await PackageFirstTrial.findOne({
        where: { package_id: package.id }
      });
      if (existingTrial) {
        await existingTrial.update({
          group_session: group_session,
          private_session: private_session
        });
      } else {
        await PackageFirstTrial.create({
          package_id: package.id,
          group_session: group_session,
          private_session: private_session
        });
      }
    }

    // Fetch the updated package with associations
    const updatedPackage = await Package.findByPk(id, {
      include: [
        {
          model: PackageFirstTrial
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: updatedPackage.id,
      name: updatedPackage.name,
      price: updatedPackage.price,
      group_session: updatedPackage.PackageFirstTrial ? updatedPackage.PackageFirstTrial.group_session : null,
      private_session: updatedPackage.PackageFirstTrial ? updatedPackage.PackageFirstTrial.private_session : null,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
      reminder_day: updatedPackage.reminder_day,
      reminder_session: updatedPackage.reminder_session
    };

    res.json({
      success: true,
      message: 'Trial package updated successfully',
      data: transformedPackage
    });
  } catch (error) {
    console.error('Error updating trial package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete trial package
const deleteTrialPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await Package.findOne({
      where: {
        id,
        type: 'first_trial'
      }
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Trial package not found'
      });
    }

    // Check if package is being used in orders
    const orderCount = await package.countOrders();
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trial package that is being used in orders'
      });
    }

    // Delete package (this will also delete related package_first_trial due to CASCADE)
    await package.destroy();

    res.json({
      success: true,
      message: 'Trial package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trial package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllTrialPackages,
  getTrialPackageById,
  createTrialPackage,
  updateTrialPackage,
  deleteTrialPackage
}; 