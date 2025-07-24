const { Package, PackageBonus, Member, MemberPackage, sequelize } = require('../models');
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
              model: Member
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
      group_session: pkg.PackageBonus ? pkg.PackageBonus.group_session : null,
      private_session: pkg.PackageBonus ? pkg.PackageBonus.private_session : null,
      member: pkg.PackageBonus && pkg.PackageBonus.member ? {
        id: pkg.PackageBonus.member.id,
        name: pkg.PackageBonus.member.full_name
      } : null,
      duration_value: pkg.duration_value,
      duration_unit: pkg.duration_unit,
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
              model: Member
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
      group_session: package.PackageBonus ? package.PackageBonus.group_session : null,
      private_session: package.PackageBonus ? package.PackageBonus.private_session : null,
      member: package.PackageBonus && package.PackageBonus.member ? {
        id: package.PackageBonus.member.id,
        name: package.PackageBonus.member.full_name
      } : null,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
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
  const t = await sequelize.transaction();
  try {
    const {
      duration_value,
      duration_unit,
      group_session,
      private_session,
      member_ids
    } = req.body;

    // Check if package with same name exists
    const existingPackage = await Package.findOne({
      where: { 
        type: 'bonus'
      },
      transaction: t
    });

    if (existingPackage) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bonus package with this name already exists'
      });
    }

    // Create bonus package
    const newPackage = await Package.create({
      type: 'bonus',
      duration_value: parseInt(duration_value),
      duration_unit,
    }, { transaction: t });

    // Create package bonus
    await PackageBonus.create({
      package_id: newPackage.id,
      group_session: group_session ? parseInt(group_session) : null,
      private_session: private_session ? parseInt(private_session) : null
    }, { transaction: t });

    // Insert to member_packages for each member_id
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'member_ids must be a non-empty array'
      });
    }
    for (const member_id of member_ids) {
      await MemberPackage.create({
        member_id,
        package_id: newPackage.id
      }, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Bonus package created and assigned to members successfully',
      data: {
        id: newPackage.id,
        group_session,
        private_session,
        duration_value: newPackage.duration_value,
        duration_unit: newPackage.duration_unit,
        member_ids
      }
    });
  } catch (error) {
    await t.rollback();
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
      duration_value,
      duration_unit,
      group_session,
      private_session,
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
    if (group_session && group_session !== package.PackageBonus.group_session) {
      const existingPackage = await Package.findOne({
        where: { 
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
      duration_value: duration_value ? parseInt(duration_value) : package.duration_value,
      duration_unit: duration_unit || package.duration_unit,
    });

    // Update package bonus
    if (group_session && private_session && member_id) {
      const existingBonus = await PackageBonus.findOne({
        where: { package_id: package.id }
      });
      if (existingBonus) {
        await existingBonus.update({
          group_session: parseInt(group_session),
          private_session: parseInt(private_session),
          member_id
        });
      } else {
        await PackageBonus.create({
          package_id: package.id,
          group_session: parseInt(group_session),
          private_session: parseInt(private_session),
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
              model: Member
            }
          ]
        }
      ]
    });

    // Transform data to match form requirements
    const transformedPackage = {
      id: updatedPackage.id,
      group_session: updatedPackage.PackageBonus ? updatedPackage.PackageBonus.group_session : null,
      private_session: updatedPackage.PackageBonus ? updatedPackage.PackageBonus.private_session : null,
      member: updatedPackage.PackageBonus && updatedPackage.PackageBonus.member ? {
        id: updatedPackage.PackageBonus.member.id,
        name: updatedPackage.PackageBonus.member.full_name
      } : null,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
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