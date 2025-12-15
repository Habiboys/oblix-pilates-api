const { User, Member } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// Get all staff with pagination and search
const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      role: 'admin'
    };

    if (search) {
      whereClause[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Member,
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform data to match form requirements
    const transformedStaff = users.map(user => ({
      id: user.id,
      full_name: user.Member ? user.Member.full_name : user.full_name,
      username: user.Member ? user.Member.username : null,
      email: user.email,
      date_of_birth: user.Member ? user.Member.dob : null,
      phone_number: user.Member ? user.Member.phone_number : null
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Staff retrieved successfully',
      data: {
        staff: transformedStaff,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting staff:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get staff by ID
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      where: {
        id,
        role: 'admin'
      },
      include: [
        {
          model: Member,
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Transform data to match form requirements
    const transformedStaff = {
      id: user.id,
      full_name: user.Member ? user.Member.full_name : user.full_name,
      username: user.Member ? user.Member.username : null,
      email: user.email,
      date_of_birth: user.Member ? user.Member.dob : null,
      phone_number: user.Member ? user.Member.phone_number : null
    };

    res.json({
      success: true,
      message: 'Staff retrieved successfully',
      data: transformedStaff
    });
  } catch (error) {
    console.error('Error getting staff:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new staff
const createStaff = async (req, res) => {
  try {
    const {
      full_name,
      username,
      email,
      date_of_birth,
      phone_number,
      password
    } = req.body;

    // Check if user with same email exists
    const existingUser = await User.findOne({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if Member with same username exists
    const existingMember = await Member.findOne({
      where: { username }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User with this username already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user (staff)
    const newUser = await User.create({
      email,
      password: hashedPassword,
      role: 'admin'
    });

    // Create Member record
    const newMember = await Member.create({
      user_id: newUser.id,
      username,
      full_name,
      phone_number,
      dob: date_of_birth,
      date_of_join: new Date(),
      status: 'Registered'
    });

    // Fetch the created user with Member association
    const createdUser = await User.findByPk(newUser.id, {
      include: [
        {
          model: Member,
        }
      ]
    });

    // Transform data to match form requirements
    const transformedStaff = {
      id: createdUser.id,
      full_name: createdUser.Member ? createdUser.Member.full_name : null,
      username: createdUser.Member ? createdUser.Member.username : null,
      email: createdUser.email,
      date_of_birth: createdUser.Member ? createdUser.Member.dob : null,
      phone_number: createdUser.Member ? createdUser.Member.phone_number : null
    };

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: transformedStaff
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update staff
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      username,
      email,
      date_of_birth,
      phone_number,
      password
    } = req.body;

    const user = await User.findOne({
      where: {
        id,
        role: 'admin'
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check if user with same email exists (excluding current user)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: {
          email,
          id: { [Op.ne]: id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    // Check if Member with same username exists (excluding current user)
    if (username) {
      const Member = await Member.findOne({
        where: { user_id: user.id }
      });

      if (Member && username !== Member.username) {
        const existingMember = await Member.findOne({
          where: {
            username,
            user_id: { [Op.ne]: user.id }
          }
        });

        if (existingMember) {
          return res.status(400).json({
            success: false,
            message: 'User with this username already exists'
          });
        }
      }
    }

    // Prepare update data for user
    const userUpdateData = {};
    if (email) userUpdateData.email = email;
    if (password) {
      const saltRounds = 10;
      userUpdateData.password = await bcrypt.hash(password, saltRounds);
    }

    // Update user
    if (Object.keys(userUpdateData).length > 0) {
      await user.update(userUpdateData);
    }

    // Update Member record
    const Member = await Member.findOne({
      where: { user_id: user.id }
    });

    if (Member) {
      const MemberUpdateData = {};
      if (full_name) MemberUpdateData.full_name = full_name;
      if (username) MemberUpdateData.username = username;
      if (phone_number) MemberUpdateData.phone_number = phone_number;
      if (date_of_birth) MemberUpdateData.dob = date_of_birth;

      if (Object.keys(MemberUpdateData).length > 0) {
        await Member.update(MemberUpdateData);
      }
    }

    // Fetch the updated user with Member association
    const updatedUser = await User.findByPk(id, {
      include: [
        {
          model: Member,
        }
      ]
    });

    // Transform data to match form requirements
    const transformedStaff = {
      id: updatedUser.id,
      full_name: updatedUser.Member ? updatedUser.Member.full_name : null,
      username: updatedUser.Member ? updatedUser.Member.username : null,
      email: updatedUser.email,
      date_of_birth: updatedUser.Member ? updatedUser.Member.dob : null,
      phone_number: updatedUser.Member ? updatedUser.Member.phone_number : null
    };

    res.json({
      success: true,
      message: 'Staff updated successfully',
      data: transformedStaff
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete staff
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      where: {
        id,
        role: 'admin'
      },
      include: [
        {
          model: Member,
          as: 'Member'
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check if staff is the only admin
    const adminCount = await User.count({
      where: { role: 'admin' }
    });

    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only admin user'
      });
    }

    // Delete associated member data first if exists
    if (user.Member) {
      await user.Member.destroy();
    }

    // Delete user
    await user.destroy();

    res.json({
      success: true,
      message: 'Staff deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff:', error);

    // Handle foreign key constraint error specifically
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete staff with associated data. Please remove all related records first.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Change staff password
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      where: {
        id,
        role: 'admin'
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password
    await user.update({
      password: hashedPassword
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing staff password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  changePassword
}; 