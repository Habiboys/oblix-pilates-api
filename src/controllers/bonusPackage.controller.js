const { Package, PackageBonus, Member, MemberPackage, sequelize, User} = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

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
        [Op.like]: `%${search}%`
      };
    }

    const { count, rows: packages } = await Package.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PackageBonus
        },
        {
          model: MemberPackage,
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

    // Debug logging untuk melihat data yang di-load
    logger.info('Raw packages data:', JSON.stringify(packages, null, 2));

    // Transform data to match form requirements
    const transformedPackages = await Promise.all(packages.map(async pkg => {
      // Debug logging untuk setiap package
      logger.info(`Package ${pkg.id}: PackageBonus data:`, pkg.PackageBonus);
      logger.info(`Package ${pkg.id}: PackageBonu data:`, pkg.PackageBonu);
      logger.info(`Package ${pkg.id}: All keys:`, Object.keys(pkg));
      
      // Ambil member dari member_packages (bisa ada multiple members)
      const members = pkg.MemberPackages ? pkg.MemberPackages.map(mp => ({
        id: mp.Member.id,
        name: mp.Member.full_name,
      })) : [];

      // Gunakan PackageBonu yang ter-load dari database
      let packageBonus = pkg.PackageBonu || pkg.PackageBonus;
      if (!packageBonus) {
        packageBonus = await PackageBonus.findOne({
          where: { package_id: pkg.id }
        });
        logger.info(`Package ${pkg.id}: Manual PackageBonus data:`, packageBonus);
      }

      return {
        package_id: pkg.id,
        group_session: packageBonus ? packageBonus.group_session : null,
        private_session: packageBonus ? packageBonus.private_session : null,
        members: members,
        duration_value: pkg.duration_value,
        duration_unit: pkg.duration_unit,
        created_at: pkg.createdAt,
        updated_at: pkg.updatedAt
      };
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
    logger.error('Error getting bonus packages:', error);
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
          model: PackageBonus
        },
        {
          model: MemberPackage,
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
    const members = package.MemberPackages ? package.MemberPackages.map(mp => ({
      id: mp.Member.id,
      name: mp.Member.full_name,
      member_code: mp.Member.member_code
    })) : [];

    const transformedPackage = {
      package_id: package.id,
      group_session: package.PackageBonus ? package.PackageBonus.group_session : null,
      private_session: package.PackageBonus ? package.PackageBonus.private_session : null,
      members: members,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      created_at: package.createdAt,
      updated_at: package.updatedAt
    };

    res.json({
      success: true,
      message: 'Bonus package retrieved successfully',
      data: transformedPackage
    });
  } catch (error) {
    logger.error('Error getting bonus package:', error);
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
      member_id
    } = req.body;

    //log pakai logger
    logger.info(`Creating bonus package with data: ${JSON.stringify(req.body)}`);


    // Validate required fields
    if (!duration_value || !duration_unit || !member_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'duration_value, duration_unit, dan member_id harus diisi'
      });
    }

    // Validate at least one session type is provided
    if ((!group_session || group_session === 0) && (!private_session || private_session === 0)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Minimal satu jenis sesi (group_session atau private_session) harus diisi'
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

    // Validate member exists
    const member = await Member.findByPk(member_id, { transaction: t });
    if (!member) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Member tidak ditemukan'
      });
    }

    await MemberPackage.create({
      member_id: member_id,
      package_id: newPackage.id
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Bonus package created and assigned to member successfully',
      data: {
        package_id: newPackage.id,
        group_session: group_session ? parseInt(group_session) : null,
        private_session: private_session ? parseInt(private_session) : null,
        duration_value: newPackage.duration_value,
        duration_unit: newPackage.duration_unit,
        member_id
      }
    });
  } catch (error) {
    await t.rollback();
    logger.error('Error creating bonus package:', error);
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

      // Update member_packages - remove old and add new
      await MemberPackage.destroy({
        where: { package_id: package.id }
      });

      await MemberPackage.create({
        member_id: member_id,
        package_id: package.id
      });
    }

    // Update package
    await package.update({
      duration_value: duration_value ? parseInt(duration_value) : package.duration_value,
      duration_unit: duration_unit || package.duration_unit,
    });

    // Update package bonus
    if (group_session && private_session) {
      const existingBonus = await PackageBonus.findOne({
        where: { package_id: package.id }
      });
      if (existingBonus) {
        await existingBonus.update({
          group_session: parseInt(group_session),
          private_session: parseInt(private_session)
        });
      } else {
        await PackageBonus.create({
          package_id: package.id,
          group_session: parseInt(group_session),
          private_session: parseInt(private_session)
        });
      }
    }

    // Fetch the updated package with associations
    const updatedPackage = await Package.findByPk(id, {
      include: [
        {
          model: PackageBonus
        },
        {
          model: MemberPackage,
          include: [
            {
              model: Member
            }
          ]
        }
      ]
    });

    // Transform data to match form requirements
    const members = updatedPackage.MemberPackages ? updatedPackage.MemberPackages.map(mp => ({
      id: mp.Member.id,
      name: mp.Member.full_name,
      member_code: mp.Member.member_code
    })) : [];

    const transformedPackage = {
      package_id: updatedPackage.id,
      group_session: updatedPackage.PackageBonus ? updatedPackage.PackageBonus.group_session : null,
      private_session: updatedPackage.PackageBonus ? updatedPackage.PackageBonus.private_session : null,
      members: members,
      duration_value: updatedPackage.duration_value,
      duration_unit: updatedPackage.duration_unit,
      created_at: updatedPackage.createdAt,
      updated_at: updatedPackage.updatedAt
    };

    res.json({
      success: true,
      message: 'Bonus package updated successfully',
      data: transformedPackage
    });
  } catch (error) {
    logger.error('Error updating bonus package:', error);
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
    logger.error('Error deleting bonus package:', error);
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
        [Op.like]: `%${search}%`
      };
    }

    const members = await Member.findAll({
      where: whereClause,
      limit: 10,
      order: [['full_name', 'ASC']],
      include: [
        {
          model: User,
        }
      ]
    });

   
    // Transform data to simple format
    const transformedMembers = members.map(member => ({
      id: member.id,
      full_name: member.full_name,
      username: member.username,
      email: member.User.email
    }));

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: transformedMembers
    });
  } catch (error) {
    logger.error('Error searching members:', error);
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