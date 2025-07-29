const { Booking, Schedule, Class, Trainer, Member, User, MemberPackage, Package, Order, PackageMembership, Category, PackageFirstTrial, PackagePromo, PackageBonus } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { calculateAvailableSessions } = require('../utils/sessionTrackingUtils');

/**
 * Get member's classes based on type (upcoming, waitlist, post, cancelled)
 */


/**
 * Cancel a booking
 */

/**
 * Get booking details
 */


const getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { member_code: { [Op.iLike]: `%${search}%` } },
        { phone_number: { [Op.iLike]: `%${search}%` } }
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
          attributes: ['id', 'email', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: {
        members,
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

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User,
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

    res.json({
      success: true,
      message: 'Member retrieved successfully',
      data: member
    });
  } catch (error) {
    console.error('Error getting member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member detail by ID (for admin view with 3 tabs)
const getMemberDetailById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get member basic info
    const member = await Member.findByPk(id, {
      include: [
        {
          model: User,
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

    // Get member packages with order details
    const memberPackages = await MemberPackage.findAll({
      where: { member_id: id },
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'price', 'type']
        },
        {
          model: Order,
          attributes: ['id', 'paid_at', 'total_amount', 'status', 'createdAt']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Get member bookings with schedule and class details
    const bookings = await Booking.findAll({
      where: { member_id: id },
      attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Schedule,
          include: [
            {
              model: Class,
              attributes: ['id', 'class_name']
            },
            {
              model: Trainer,
              attributes: ['id', 'title']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format packages data
    const formattedPackages = memberPackages.map((mp, index) => {
      // Calculate initial sessions based on package type
      let initialGroupSessions = 0;
      let initialSemiPrivateSessions = 0;
      let initialPrivateSessions = 0;
      let totalInitialSessions = 0;

      if (mp.Package?.type === 'membership' && mp.Package?.PackageMembership) {
        const sessionCount = mp.Package.PackageMembership.session || 0;
        const categoryName = mp.Package.PackageMembership.Category?.category_name;
        
        if (categoryName === 'Semi-Private Class') {
          initialSemiPrivateSessions = sessionCount;
        } else if (categoryName === 'Private Class') {
          initialPrivateSessions = sessionCount;
        } else {
          // Default ke group (termasuk 'Group Class' atau category lain)
          initialGroupSessions = sessionCount;
        }
        totalInitialSessions = sessionCount;
      } else if (mp.Package?.type === 'first_trial' && mp.Package?.PackageFirstTrial) {
        initialGroupSessions = mp.Package.PackageFirstTrial.group_session || 0;
        initialPrivateSessions = mp.Package.PackageFirstTrial.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      } else if (mp.Package?.type === 'promo' && mp.Package?.PackagePromo) {
        initialGroupSessions = mp.Package.PackagePromo.group_session || 0;
        initialPrivateSessions = mp.Package.PackagePromo.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      } else if (mp.Package?.type === 'bonus' && mp.Package?.PackageBonus) {
        initialGroupSessions = mp.Package.PackageBonus.group_session || 0;
        initialPrivateSessions = mp.Package.PackageBonus.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      }

      // Get remaining sessions from member package
      const remainingGroupSessions = mp.remaining_group_session || 0;
      const remainingSemiPrivateSessions = mp.remaining_semi_private_session || 0;
      const remainingPrivateSessions = mp.remaining_private_session || 0;
      const totalRemainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

      return {
        no: index + 1,
        payment_date: mp.Order?.paid_at ? new Date(mp.Order.paid_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : (mp.Order?.createdAt ? new Date(mp.Order.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : '-'),
        expired_date: mp.end_date ? new Date(mp.end_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : '-',
        package: mp.Package?.name || '-',
        initial_session: {
          total: totalInitialSessions,
          group: initialGroupSessions,
          semi_private: initialSemiPrivateSessions,
          private: initialPrivateSessions
        },
        session_left: {
          total: totalRemainingSessions,
          group: remainingGroupSessions,
          semi_private: remainingSemiPrivateSessions,
          private: remainingPrivateSessions
        },
        price: mp.Order?.total_amount ? `Rp${mp.Order.total_amount.toLocaleString()}` : '-'
      };
    });

    // Format bookings data
    const formattedBookings = bookings.map((booking, index) => ({
      no: index + 1,
      booked_date: new Date(booking.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      class_date: new Date(booking.Schedule.date_start).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      time: `${booking.Schedule.time_start} - ${booking.Schedule.time_end}`,
      course: booking.Schedule.Class?.class_name || '-',
      coach: booking.Schedule.Trainer?.title || '-'
    }));

    // Format member profile data
    const profileData = {
      full_name: member.full_name,
      username: member.username,
      email: member.User.email,
      date_of_birth: member.dob ? new Date(member.dob).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '-',
      phone_number: member.phone_number,
      join_date: member.date_of_join ? new Date(member.date_of_join).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '-'
    };

    res.json({
      success: true,
      message: 'Member detail retrieved successfully',
      data: {
        profile: profileData,
        packages: formattedPackages,
        bookings: formattedBookings
      }
    });
  } catch (error) {
    console.error('Error getting member detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member profile data only
const getMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User,
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

    // Format member profile data
    const profileData = {
      full_name: member.full_name,
      username: member.username,
      email: member.User.email,
      date_of_birth: member.dob ? new Date(member.dob).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '-',
      phone_number: member.phone_number,
      join_date: member.date_of_join ? new Date(member.date_of_join).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '-'
    };

    res.json({
      success: true,
      message: 'Member profile retrieved successfully',
      data: profileData
    });
  } catch (error) {
    console.error('Error getting member profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member packages data only
const getMemberPackages = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get member packages with order details and package details
    const memberPackages = await MemberPackage.findAll({
      where: { member_id: id },
      include: [
        {
          model: Package,
          include: [
            {
              model: PackageMembership,
              include: [{ model: Category }]
            },
            {
              model: PackageFirstTrial
            },
            {
              model: PackagePromo
            },
            {
              model: PackageBonus
            }
          ]
        },
        {
          model: Order,
          attributes: ['id', 'paid_at', 'total_amount', 'status', 'createdAt']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Get total available sessions using utils
    const sessionInfo = await calculateAvailableSessions(id);

    // Format packages data
    const formattedPackages = memberPackages.map((mp, index) => {
      // Calculate initial sessions based on package type
      let initialGroupSessions = 0;
      let initialSemiPrivateSessions = 0;
      let initialPrivateSessions = 0;
      let totalInitialSessions = 0;

      if (mp.Package?.type === 'membership' && mp.Package?.PackageMembership) {
        const sessionCount = mp.Package.PackageMembership.session || 0;
        const categoryName = mp.Package.PackageMembership.Category?.category_name;
        
        if (categoryName === 'Semi-Private Class') {
          initialSemiPrivateSessions = sessionCount;
        } else if (categoryName === 'Private Class') {
          initialPrivateSessions = sessionCount;
        } else {
          // Default ke group (termasuk 'Group Class' atau category lain)
          initialGroupSessions = sessionCount;
        }
        totalInitialSessions = sessionCount;
      } else if (mp.Package?.type === 'first_trial' && mp.Package?.PackageFirstTrial) {
        initialGroupSessions = mp.Package.PackageFirstTrial.group_session || 0;
        initialPrivateSessions = mp.Package.PackageFirstTrial.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      } else if (mp.Package?.type === 'promo' && mp.Package?.PackagePromo) {
        initialGroupSessions = mp.Package.PackagePromo.group_session || 0;
        initialPrivateSessions = mp.Package.PackagePromo.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      } else if (mp.Package?.type === 'bonus' && mp.Package?.PackageBonus) {
        initialGroupSessions = mp.Package.PackageBonus.group_session || 0;
        initialPrivateSessions = mp.Package.PackageBonus.private_session || 0;
        totalInitialSessions = initialGroupSessions + initialPrivateSessions;
      }

      // Get remaining sessions from member package
      const remainingGroupSessions = mp.remaining_group_session || 0;
      const remainingSemiPrivateSessions = mp.remaining_semi_private_session || 0;
      const remainingPrivateSessions = mp.remaining_private_session || 0;
      const totalRemainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

      return {
        no: index + 1,
        payment_date: mp.Order?.paid_at ? new Date(mp.Order.paid_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : (mp.Order?.createdAt ? new Date(mp.Order.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : '-'),
        expired_date: mp.end_date ? new Date(mp.end_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : '-',
        package: mp.Package?.name || '-',
        initial_session: {
          total: totalInitialSessions,
          group: initialGroupSessions,
          semi_private: initialSemiPrivateSessions,
          private: initialPrivateSessions
        },
        session_left: {
          total: totalRemainingSessions,
          group: remainingGroupSessions,
          semi_private: remainingSemiPrivateSessions,
          private: remainingPrivateSessions
        },
        price: mp.Order?.total_amount ? `Rp${mp.Order.total_amount.toLocaleString()}` : '-'
      };
    });

    res.json({
      success: true,
      message: 'Member packages retrieved successfully',
      data: formattedPackages
    });
  } catch (error) {
    console.error('Error getting member packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member bookings data only
const getMemberBookings = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get member bookings with schedule and class details
    const bookings = await Booking.findAll({
      where: { member_id: id },
      attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Schedule,
          include: [
            {
              model: Class,
              attributes: ['id', 'class_name']
            },
            {
              model: Trainer,
              attributes: ['id', 'title']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format bookings data
    const formattedBookings = bookings.map((booking, index) => ({
      no: index + 1,
      booked_date: new Date(booking.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      class_date: new Date(booking.Schedule.date_start).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      time: `${booking.Schedule.time_start} - ${booking.Schedule.time_end}`,
      course: booking.Schedule.Class?.class_name || '-',
      coach: booking.Schedule.Trainer?.title || '-'
    }));

    res.json({
      success: true,
      message: 'Member bookings retrieved successfully',
      data: formattedBookings
    });
  } catch (error) {
    console.error('Error getting member bookings:', error);
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
      where: { username }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Username sudah digunakan'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email }
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
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: createdMember
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

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User
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
          }
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
    const updatedMember = await Member.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember
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

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User
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


module.exports = {


  getAllMembers,
  getMemberById,
  getMemberDetailById,
  createMember,
  updateMember,
  deleteMember,
  getMemberProfile,
  getMemberPackages,
  getMemberBookings,
 
}; 