const { User, Member } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { generateMemberCode, calculateMemberSessionStats } = require('../utils/memberUtils');

// Get all members with pagination and search
const getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { member_code: { [Op.like]: `%${search}%` } },
        { phone_number: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          where: { role: 'user' },
          attributes: ['id', 'email', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit);

    // Calculate session statistics for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const sessionStats = await calculateMemberSessionStats(member.id);
        return {
          ...member.toJSON(),
          sessionStats
        };
      })
    );

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: {
        members: membersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting members:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findOne({
      where: { id },
      include: [
        {
          model: User,
          where: { role: 'user' },
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Calculate session statistics
    const sessionStats = await calculateMemberSessionStats(id);

    res.json({
      success: true,
      message: 'Member retrieved successfully',
      data: {
        ...member.toJSON(),
        sessionStats
      }
    });
  } catch (error) {
    console.error('Error getting member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new member
const createMember = async (req, res) => {
  try {
    const {
      full_name,
      username,
      phone_number,
      dob,
      address,
      email,
      password,
      picture
    } = req.body;

    // Check if username already exists
    const existingMember = await Member.findOne({
      where: { username },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Username sudah digunakan'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email, role: 'user' }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah digunakan'
      });
    }

    // Generate member code
    const memberCode = await generateMemberCode();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user first
    const user = await User.create({
      email,
      password: hashedPassword,
      role: 'user'
    });

    // Create member
    const member = await Member.create({
      member_code: memberCode,
      username,
      full_name,
      phone_number,
      dob: new Date(dob),
      address,
      date_of_join: new Date(),
      picture,
      status: 'active',
      user_id: user.id
    });

    // Fetch member with user data
    const createdMember = await Member.findByPk(member.id, {
      include: [
        {
          model: User,
          where: { role: 'user' },
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    // Calculate session statistics
    const sessionStats = await calculateMemberSessionStats(createdMember.id);

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: {
        ...createdMember.toJSON(),
        sessionStats
      }
    });
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      username,
      phone_number,
      dob,
      address,
      email,
      password,
      picture,
      status
    } = req.body;

    const member = await Member.findOne({
      where: { id },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check if username already exists (excluding current member)
    if (username && username !== member.username) {
      const existingMember = await Member.findOne({
        where: { 
          username,
          id: { [Op.ne]: id }
        },
        include: [
          {
            model: User,
            where: { role: 'user' }
          }
        ]
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Username sudah digunakan'
        });
      }
    }

    // Check if email already exists (excluding current user)
    if (email && email !== member.User.email) {
      const existingUser = await User.findOne({
        where: { 
          email,
          role: 'user',
          id: { [Op.ne]: member.user_id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah digunakan'
        });
      }
    }

    // Update member data
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (username) updateData.username = username;
    if (phone_number) updateData.phone_number = phone_number;
    if (dob) updateData.dob = new Date(dob);
    if (address !== undefined) updateData.address = address;
    if (picture !== undefined) updateData.picture = picture;
    if (status) updateData.status = status;

    await member.update(updateData);

    // Update user data
    const userUpdateData = {};
    if (email) userUpdateData.email = email;
    if (password) {
      userUpdateData.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(userUpdateData).length > 0) {
      await member.User.update(userUpdateData);
    }

    // Fetch updated member
    const updatedMember = await Member.findOne({
      where: { id },
      include: [
        {
          model: User,
          where: { role: 'user' },
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    // Calculate session statistics
    const sessionStats = await calculateMemberSessionStats(updatedMember.id);

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: {
        ...updatedMember.toJSON(),
        sessionStats
      }
    });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete member
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findOne({
      where: { id },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Delete member first (due to foreign key constraint)
    await member.destroy();

    // Delete associated user
    await member.User.destroy();

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member statistics
const getMemberStats = async (req, res) => {
  try {
    const totalMembers = await Member.count({
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });
    
    const activeMembers = await Member.count({
      where: { status: 'active' },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });
    
    const inactiveMembers = await Member.count({
      where: { status: 'inactive' },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });

    // Get members joined this month
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const newMembersThisMonth = await Member.count({
      where: {
        date_of_join: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      },
      include: [
        {
          model: User,
          where: { role: 'user' }
        }
      ]
    });

    res.json({
      success: true,
      message: 'Member statistics retrieved successfully',
      data: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        newMembersThisMonth
      }
    });
  } catch (error) {
    console.error('Error getting member stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMemberStats
}; 