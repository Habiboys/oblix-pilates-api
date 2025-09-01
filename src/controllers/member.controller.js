const { Booking, Schedule, Class, Trainer, Member, User, MemberPackage, Package, Order, PackageMembership, Category, PackageFirstTrial, PackagePromo, PackageBonus } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const { calculateAvailableSessions, updateAllMemberPackagesSessionUsage } = require('../utils/sessionTrackingUtils');
const { generateMemberCode } = require('../utils/memberUtils');

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

    // Clean search input - remove leading/trailing spaces
    const cleanSearch = search.trim();

    const whereClause = {};
    
    if (cleanSearch) {
      whereClause[Op.or] = [
        { full_name: { [Op.like]: `%${cleanSearch}%` } },
        { username: { [Op.like]: `%${cleanSearch}%` } },
        { member_code: { [Op.like]: `%${cleanSearch}%` } },
        { phone_number: { [Op.like]: `%${cleanSearch}%` } },
       
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

    // Tidak perlu update session usage di sini karena akan meng-overwrite bonus package
    // Session usage akan diupdate saat ada booking baru

    // Get member packages untuk menghitung detail sesi (hanya package yang valid)
    const membersWithSessions = await Promise.all(members.map(async (member) => {
      const currentDate = new Date().toISOString().split('T')[0];
      
      const memberPackages = await MemberPackage.findAll({
        where: { 
          member_id: member.id,
          // Filter package yang valid (belum expired dan sudah aktif)
          [Op.or]: [
            {
              // Package yang sudah aktif (ada start_date) dan belum expired
              start_date: { [Op.ne]: null },
              end_date: { [Op.gte]: currentDate }
            },
            {
              // Package yang belum aktif (belum ada start_date) - akan aktif saat booking pertama
              start_date: null
            }
          ]
        },
        include: [
          {
            model: Package,
            attributes: ['id', 'name', 'type'],
            include: [
              {
                model: PackageMembership,
                attributes: ['session'],
                include: [
                  {
                    model: Category,
                    attributes: ['category_name']
                  }
                ]
              },
              {
                model: PackageFirstTrial,
                attributes: ['group_session', 'private_session']
              },
              {
                model: PackagePromo,
                attributes: ['group_session', 'private_session']
              },
              {
                model: PackageBonus,
                attributes: ['group_session', 'private_session']
              }
            ]
          }
        ]
      });

      // Calculate total sessions for each type
      let totalGroupSessions = 0;
      let totalSemiPrivateSessions = 0;
      let totalPrivateSessions = 0;
      let usedGroupSessions = 0;
      let usedSemiPrivateSessions = 0;
      let usedPrivateSessions = 0;
      let remainingGroupSessions = 0;
      let remainingSemiPrivateSessions = 0;
      let remainingPrivateSessions = 0;

      memberPackages.forEach(memberPackage => {
        // Get total sessions based on package type
        let groupSessions = 0;
        let semiPrivateSessions = 0;
        let privateSessions = 0;
        
        if (memberPackage.Package?.type === 'membership' && memberPackage.Package?.PackageMembership) {
          const categoryName = memberPackage.Package.PackageMembership.Category?.category_name;
          const sessionCount = memberPackage.Package.PackageMembership.session || 0;
          
          if (categoryName === 'Semi-Private Class') {
            semiPrivateSessions = sessionCount;
          } else if (categoryName === 'Private Class') {
            privateSessions = sessionCount;
          } else {
            groupSessions = sessionCount;
          }
        } else if (memberPackage.Package?.type === 'first_trial' && memberPackage.Package?.PackageFirstTrial) {
          groupSessions = memberPackage.Package.PackageFirstTrial.group_session || 0;
          privateSessions = memberPackage.Package.PackageFirstTrial.private_session || 0;
        } else if (memberPackage.Package?.type === 'promo' && memberPackage.Package?.PackagePromo) {
          groupSessions = memberPackage.Package.PackagePromo.group_session || 0;
          privateSessions = memberPackage.Package.PackagePromo.private_session || 0;
        } else if (memberPackage.Package?.type === 'bonus' && memberPackage.Package?.PackageBonus) {
          groupSessions = memberPackage.Package.PackageBonus.group_session || 0;
          privateSessions = memberPackage.Package.PackageBonus.private_session || 0;
        }

        totalGroupSessions += groupSessions;
        totalSemiPrivateSessions += semiPrivateSessions;
        totalPrivateSessions += privateSessions;

        // Add used and remaining sessions
        usedGroupSessions += memberPackage.used_group_session || 0;
        usedSemiPrivateSessions += memberPackage.used_semi_private_session || 0;
        usedPrivateSessions += memberPackage.used_private_session || 0;
        remainingGroupSessions += memberPackage.remaining_group_session || 0;
        remainingSemiPrivateSessions += memberPackage.remaining_semi_private_session || 0;
        remainingPrivateSessions += memberPackage.remaining_private_session || 0;
      });

      // Calculate total sessions
      const totalSessions = totalGroupSessions + totalSemiPrivateSessions + totalPrivateSessions;
      const totalUsedSessions = usedGroupSessions + usedSemiPrivateSessions + usedPrivateSessions;
      const totalRemainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

      // Tambahkan informasi package yang valid
      const validPackages = memberPackages.map(mp => ({
        id: mp.id,
        package_name: mp.Package?.name || 'Unknown Package',
        package_type: mp.Package?.type || 'unknown',
        start_date: mp.start_date,
        end_date: mp.end_date,
        is_active: mp.start_date ? (new Date(mp.end_date) >= new Date(currentDate)) : true,
        remaining_sessions: {
          group: mp.remaining_group_session || 0,
          semi_private: mp.remaining_semi_private_session || 0,
          private: mp.remaining_private_session || 0
        },
        used_sessions: {
          group: mp.used_group_session || 0,
          semi_private: mp.used_semi_private_session || 0,
          private: mp.used_private_session || 0
        }
      }));

      return {
        ...member.toJSON(),
        session_details: {
          total_sessions: totalSessions,
          used_sessions: totalUsedSessions,
          remaining_sessions: totalRemainingSessions,
          group_sessions: {
            total: totalGroupSessions,
            used: usedGroupSessions,
            remaining: remainingGroupSessions,
            progress_percentage: totalGroupSessions > 0 ? Math.round((usedGroupSessions / totalGroupSessions) * 100) : 0
          },
          semi_private_sessions: {
            total: totalSemiPrivateSessions,
            used: usedSemiPrivateSessions,
            remaining: remainingSemiPrivateSessions,
            progress_percentage: totalSemiPrivateSessions > 0 ? Math.round((usedSemiPrivateSessions / totalSemiPrivateSessions) * 100) : 0
          },
          private_sessions: {
            total: totalPrivateSessions,
            used: usedPrivateSessions,
            remaining: remainingPrivateSessions,
            progress_percentage: totalPrivateSessions > 0 ? Math.round((usedPrivateSessions / totalPrivateSessions) * 100) : 0
          }
        },
        valid_packages: validPackages,
        package_count: {
          total: memberPackages.length,
          active: validPackages.filter(p => p.is_active).length,
          expired: validPackages.filter(p => !p.is_active && p.start_date).length,
          not_started: validPackages.filter(p => !p.start_date).length
        }
      };
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: {
        members: membersWithSessions,
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

    // Tidak perlu update session usage di sini karena akan meng-overwrite bonus package
    // Session usage akan diupdate saat ada booking baru

    // Get member packages untuk menghitung detail sesi
    const memberPackages = await MemberPackage.findAll({
      where: { member_id: id },
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'type'],
          include: [
            {
              model: PackageMembership,
              attributes: ['session'],
              include: [
                {
                  model: Category,
                  attributes: ['category_name']
                }
              ]
            },
            {
              model: PackageFirstTrial,
              attributes: ['group_session', 'private_session']
            },
            {
              model: PackagePromo,
              attributes: ['group_session', 'private_session']
            },
            {
              model: PackageBonus,
              attributes: ['group_session', 'private_session']
            }
          ]
        }
      ]
    });

    // Calculate total sessions for each type
    let totalGroupSessions = 0;
    let totalSemiPrivateSessions = 0;
    let totalPrivateSessions = 0;
    let usedGroupSessions = 0;
    let usedSemiPrivateSessions = 0;
    let usedPrivateSessions = 0;
    let remainingGroupSessions = 0;
    let remainingSemiPrivateSessions = 0;
    let remainingPrivateSessions = 0;

    memberPackages.forEach(memberPackage => {
      // Get total sessions based on package type
      let groupSessions = 0;
      let semiPrivateSessions = 0;
      let privateSessions = 0;
      
      if (memberPackage.Package?.type === 'membership' && memberPackage.Package?.PackageMembership) {
        const categoryName = memberPackage.Package.PackageMembership.Category?.category_name;
        const sessionCount = memberPackage.Package.PackageMembership.session || 0;
        
        if (categoryName === 'Semi-Private Class') {
          semiPrivateSessions = sessionCount;
        } else if (categoryName === 'Private Class') {
          privateSessions = sessionCount;
        } else {
          groupSessions = sessionCount;
        }
      } else if (memberPackage.Package?.type === 'first_trial' && memberPackage.Package?.PackageFirstTrial) {
        groupSessions = memberPackage.Package.PackageFirstTrial.group_session || 0;
        privateSessions = memberPackage.Package.PackageFirstTrial.private_session || 0;
      } else if (memberPackage.Package?.type === 'promo' && memberPackage.Package?.PackagePromo) {
        groupSessions = memberPackage.Package.PackagePromo.group_session || 0;
        privateSessions = memberPackage.Package.PackagePromo.private_session || 0;
      } else if (memberPackage.Package?.type === 'bonus' && memberPackage.Package?.PackageBonus) {
        groupSessions = memberPackage.Package.PackageBonus.group_session || 0;
        privateSessions = memberPackage.Package.PackageBonus.private_session || 0;
      }

      totalGroupSessions += groupSessions;
      totalSemiPrivateSessions += semiPrivateSessions;
      totalPrivateSessions += privateSessions;

      // Add used and remaining sessions
      usedGroupSessions += memberPackage.used_group_session || 0;
      usedSemiPrivateSessions += memberPackage.used_semi_private_session || 0;
      usedPrivateSessions += memberPackage.used_private_session || 0;
      remainingGroupSessions += memberPackage.remaining_group_session || 0;
      remainingSemiPrivateSessions += memberPackage.remaining_semi_private_session || 0;
      remainingPrivateSessions += memberPackage.remaining_private_session || 0;
    });

    // Calculate total sessions
    const totalSessions = totalGroupSessions + totalSemiPrivateSessions + totalPrivateSessions;
    const totalUsedSessions = usedGroupSessions + usedSemiPrivateSessions + usedPrivateSessions;
    const totalRemainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

    const memberWithSessions = {
      ...member.toJSON(),
      session_details: {
        total_sessions: totalSessions,
        used_sessions: totalUsedSessions,
        remaining_sessions: totalRemainingSessions,
        group_sessions: {
          total: totalGroupSessions,
          used: usedGroupSessions,
          remaining: remainingGroupSessions,
          progress_percentage: totalGroupSessions > 0 ? Math.round((usedGroupSessions / totalGroupSessions) * 100) : 0
        },
        semi_private_sessions: {
          total: totalSemiPrivateSessions,
          used: usedSemiPrivateSessions,
          remaining: remainingSemiPrivateSessions,
          progress_percentage: totalSemiPrivateSessions > 0 ? Math.round((usedSemiPrivateSessions / totalSemiPrivateSessions) * 100) : 0
        },
        private_sessions: {
          total: totalPrivateSessions,
          used: usedPrivateSessions,
          remaining: remainingPrivateSessions,
          progress_percentage: totalPrivateSessions > 0 ? Math.round((usedPrivateSessions / totalPrivateSessions) * 100) : 0
        }
      }
    };

    res.json({
      success: true,
      message: 'Member retrieved successfully',
      data: memberWithSessions
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
          attributes: [
            'id', 'class_id', 'picture', 'trainer_id', 'pax', 'type', 
            'date_start', 'time_start', 'time_end', 'repeat_type', 
            'repeat_days', 'schedule_until', 'booking_deadline_hour', 
            'min_signup', 'cancel_buffer_minutes', 'parent_schedule_id', 
            'member_id', 'level', 'createdAt', 'updatedAt'
          ],
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
      // Calculate initial sessions based on MemberPackage data (remaining + used)
      const usedGroupSessions = mp.used_group_session || 0;
      const usedSemiPrivateSessions = mp.used_semi_private_session || 0;
      const usedPrivateSessions = mp.used_private_session || 0;
      const remainingGroupSessions = mp.remaining_group_session || 0;
      const remainingSemiPrivateSessions = mp.remaining_semi_private_session || 0;
      const remainingPrivateSessions = mp.remaining_private_session || 0;
      
      // Total = remaining + used
      const initialGroupSessions = remainingGroupSessions + usedGroupSessions;
      const initialSemiPrivateSessions = remainingSemiPrivateSessions + usedSemiPrivateSessions;
      const initialPrivateSessions = remainingPrivateSessions + usedPrivateSessions;
      const totalInitialSessions = initialGroupSessions + initialSemiPrivateSessions + initialPrivateSessions;

      // Get remaining sessions from member package
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
      // Calculate initial sessions based on MemberPackage data (remaining + used)
      const usedGroupSessions = mp.used_group_session || 0;
      const usedSemiPrivateSessions = mp.used_semi_private_session || 0;
      const usedPrivateSessions = mp.used_private_session || 0;
      const remainingGroupSessions = mp.remaining_group_session || 0;
      const remainingSemiPrivateSessions = mp.remaining_semi_private_session || 0;
      const remainingPrivateSessions = mp.remaining_private_session || 0;
      
      // Total = remaining + used
      const initialGroupSessions = remainingGroupSessions + usedGroupSessions;
      const initialSemiPrivateSessions = remainingSemiPrivateSessions + usedSemiPrivateSessions;
      const initialPrivateSessions = remainingPrivateSessions + usedPrivateSessions;
      const totalInitialSessions = initialGroupSessions + initialSemiPrivateSessions + initialPrivateSessions;

      // Get remaining sessions from member package
      const totalRemainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

      return {
        id: mp.id, // Tambahkan ID member package
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
        start_date: mp.start_date ? new Date(mp.start_date).toLocaleDateString('en-GB', {
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
          attributes: [
            'id', 'class_id', 'picture', 'trainer_id', 'pax', 'type', 
            'date_start', 'time_start', 'time_end', 'repeat_type', 
            'repeat_days', 'schedule_until', 'booking_deadline_hour', 
            'min_signup', 'cancel_buffer_minutes', 'parent_schedule_id', 
            'member_id', 'level', 'createdAt', 'updatedAt'
          ],
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
      status: 'Registered', // Menggunakan default value dari model
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

// Add package to member (admin function)
const addPackageToMember = async (req, res) => {
  try {
    const { id: member_id } = req.params; // Ambil dari URL parameter
    const { package_id, order_id } = req.body;

    // Validasi input
    if (!package_id) {
      return res.status(400).json({
        success: false,
        message: 'package_id harus diisi'
      });
    }

    // Cek apakah member exists
    const member = await Member.findByPk(member_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member tidak ditemukan'
      });
    }

    // Cek apakah package exists dengan relasi lengkap
    const package = await Package.findByPk(package_id, {
      include: [
        {
          model: PackageMembership,
          include: [
            {
              model: Category,
              attributes: ['category_name']
            }
          ]
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
    });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package tidak ditemukan'
      });
    }

    // Cek apakah order exists (jika ada)
    if (order_id) {
      const order = await Order.findByPk(order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order tidak ditemukan'
        });
      }
    }

    // Hitung session berdasarkan package type
    let remainingGroupSessions = 0;
    let remainingSemiPrivateSessions = 0;
    let remainingPrivateSessions = 0;

    if (package.type === 'membership' && package.PackageMembership) {
      const sessionCount = package.PackageMembership.session || 0;
      const categoryName = package.PackageMembership.Category?.category_name;
      
      if (categoryName === 'Semi-Private Class') {
        remainingSemiPrivateSessions = sessionCount;
      } else if (categoryName === 'Private Class') {
        remainingPrivateSessions = sessionCount;
      } else {
        // Default ke group (termasuk 'Group Class' atau category lain)
        remainingGroupSessions = sessionCount;
      }
    } else if (package.type === 'first_trial' && package.PackageFirstTrial) {
      remainingGroupSessions = package.PackageFirstTrial.group_session || 0;
      remainingPrivateSessions = package.PackageFirstTrial.private_session || 0;
    } else if (package.type === 'promo' && package.PackagePromo) {
      remainingGroupSessions = package.PackagePromo.group_session || 0;
      remainingPrivateSessions = package.PackagePromo.private_session || 0;
    } else if (package.type === 'bonus' && package.PackageBonus) {
      remainingGroupSessions = package.PackageBonus.group_session || 0;
      remainingPrivateSessions = package.PackageBonus.private_session || 0;
    }

    // Hitung tanggal berdasarkan paket template
    const currentDate = new Date();
    let packageStartDate = null; // Akan diset saat booking pertama
    let packageEndDate = null;
    let activePeriod = 0;

    // Ambil durasi dari paket template
    if (package.type === 'membership' && package.PackageMembership) {
      activePeriod = package.PackageMembership.active_period || 0;
    } else if (package.type === 'first_trial' && package.PackageFirstTrial) {
      activePeriod = package.PackageFirstTrial.active_period || 0;
    } else if (package.type === 'promo' && package.PackagePromo) {
      activePeriod = package.PackagePromo.active_period || 0;
    } else if (package.type === 'bonus' && package.PackageBonus) {
      activePeriod = package.PackageBonus.active_period || 0;
    }

    // Set end_date berdasarkan active_period dari paket template
    if (activePeriod > 0) {
      packageEndDate = new Date(currentDate);
      packageEndDate.setDate(packageEndDate.getDate() + (activePeriod * 7)); // active_period dalam minggu
    }

    // Buat member package
    const memberPackage = await MemberPackage.create({
      member_id,
      package_id,
      order_id: order_id || null,
      start_date: packageStartDate, // null, akan diset saat booking pertama
      end_date: packageEndDate, // berdasarkan active_period dari paket template
      active_period: activePeriod, // dari paket template
      remaining_group_session: remainingGroupSessions,
      remaining_semi_private_session: remainingSemiPrivateSessions,
      remaining_private_session: remainingPrivateSessions,
      used_group_session: 0,
      used_semi_private_session: 0,
      used_private_session: 0
    });

    res.status(201).json({
      success: true,
      message: 'Paket berhasil ditambahkan ke member',
      data: {
        member_package_id: memberPackage.id,
        member_name: member.full_name,
        package_name: package.name,
        package_type: package.type,
        start_date: packageStartDate, // null, akan aktif saat booking pertama
        end_date: packageEndDate, // berdasarkan active_period dari paket template
        active_period: activePeriod, // dari paket template (minggu)
        sessions: {
          group: remainingGroupSessions,
          semi_private: remainingSemiPrivateSessions,
          private: remainingPrivateSessions,
          total: remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions
        },
        note: 'Paket akan aktif saat member melakukan booking pertama'
      }
    });

  } catch (error) {
    logger.error('Error adding package to member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Extend package duration (admin function)
const extendPackageDuration = async (req, res) => {
  try {
    const { member_package_id } = req.params; // Ambil dari URL parameter
    const { extend_weeks, new_end_date } = req.body;

    // Validasi input
    if (!member_package_id) {
      return res.status(400).json({
        success: false,
        message: 'member_package_id harus diisi'
      });
    }

    if (!extend_weeks && !new_end_date) {
      return res.status(400).json({
        success: false,
        message: 'extend_weeks atau new_end_date harus diisi'
      });
    }

    // Cek apakah member package exists
    const memberPackage = await MemberPackage.findByPk(member_package_id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'full_name', 'phone_number']
        },
        {
          model: Package,
          attributes: ['id', 'name', 'type']
        }
      ]
    });

    if (!memberPackage) {
      return res.status(404).json({
        success: false,
        message: 'Member package tidak ditemukan'
      });
    }

    // Hitung end date baru
    let newEndDate;
    if (new_end_date) {
      newEndDate = new Date(new_end_date);
    } else if (extend_weeks) {
      const currentEndDate = memberPackage.end_date ? new Date(memberPackage.end_date) : new Date();
      newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + (extend_weeks * 7));
    }

    // Validasi bahwa end date baru lebih besar dari yang lama
    if (memberPackage.end_date && newEndDate <= new Date(memberPackage.end_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date baru harus lebih besar dari end date yang lama'
      });
    }

    // Update member package
    const updatedMemberPackage = await memberPackage.update({
      end_date: newEndDate,
      active_period: memberPackage.active_period + (extend_weeks || 0)
    });

    res.json({
      success: true,
      message: 'Durasi package berhasil diperpanjang',
      data: {
        member_package_id: updatedMemberPackage.id,
        member_name: memberPackage.Member.full_name,
        package_name: memberPackage.Package.name,
        old_end_date: memberPackage.end_date,
        new_end_date: newEndDate,
        extended_weeks: extend_weeks || 'custom',
        active_period: updatedMemberPackage.active_period
      }
    });

  } catch (error) {
    logger.error('Error extending package duration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member package (admin function)
const updateMemberPackage = async (req, res) => {
  try {
    const { member_package_id } = req.params;
    const {
      remaining_group_session,
      remaining_semi_private_session,
      remaining_private_session,
      used_group_session,
      used_semi_private_session,
      used_private_session,
      start_date,
      end_date
    } = req.body;

    // Find member package
    const memberPackage = await MemberPackage.findByPk(member_package_id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'full_name', 'phone_number']
        },
        {
          model: Package,
          attributes: ['id', 'name', 'type']
        }
      ]
    });

    if (!memberPackage) {
      return res.status(404).json({
        success: false,
        message: 'Member package not found'
      });
    }

    // Validate session numbers (cannot be negative)
    const sessionFields = [
      { name: 'remaining_group_session', value: remaining_group_session },
      { name: 'remaining_semi_private_session', value: remaining_semi_private_session },
      { name: 'remaining_private_session', value: remaining_private_session },
      { name: 'used_group_session', value: used_group_session },
      { name: 'used_semi_private_session', value: used_semi_private_session },
      { name: 'used_private_session', value: used_private_session }
    ];

    for (const field of sessionFields) {
      if (field.value !== undefined && field.value < 0) {
        return res.status(400).json({
          success: false,
          message: `${field.name} cannot be negative`
        });
      }
    }

    // Validate date formats if provided
    if (start_date && !Date.parse(start_date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_date format. Use YYYY-MM-DD'
      });
    }

    if (end_date && !Date.parse(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end_date format. Use YYYY-MM-DD'
      });
    }

    // Validate start_date <= end_date if both are provided
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    // Prepare update data
    const updateData = {};
    
    if (remaining_group_session !== undefined) updateData.remaining_group_session = parseInt(remaining_group_session);
    if (remaining_semi_private_session !== undefined) updateData.remaining_semi_private_session = parseInt(remaining_semi_private_session);
    if (remaining_private_session !== undefined) updateData.remaining_private_session = parseInt(remaining_private_session);
    if (used_group_session !== undefined) updateData.used_group_session = parseInt(used_group_session);
    if (used_semi_private_session !== undefined) updateData.used_semi_private_session = parseInt(used_semi_private_session);
    if (used_private_session !== undefined) updateData.used_private_session = parseInt(used_private_session);
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;

    // Update member package
    await memberPackage.update(updateData);

    // Log the update
    logger.info(`✅ Member package updated by admin: ${memberPackage.id}`);
    logger.info(`📊 Updated fields:`, updateData);
    logger.info(`👤 Member: ${memberPackage.Member.full_name}`);
    logger.info(`📦 Package: ${memberPackage.Package.name}`);

    // Get updated member package with relations
    const updatedMemberPackage = await MemberPackage.findByPk(member_package_id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'full_name', 'phone_number']
        },
        {
          model: Package,
          attributes: ['id', 'name', 'type']
        }
      ]
    });

    // Calculate total sessions
    const totalGroupSessions = (updatedMemberPackage.remaining_group_session || 0) + (updatedMemberPackage.used_group_session || 0);
    const totalSemiPrivateSessions = (updatedMemberPackage.remaining_semi_private_session || 0) + (updatedMemberPackage.used_semi_private_session || 0);
    const totalPrivateSessions = (updatedMemberPackage.remaining_private_session || 0) + (updatedMemberPackage.used_private_session || 0);

    res.json({
      success: true,
      message: 'Member package updated successfully',
      data: {
        member_package_id: updatedMemberPackage.id,
        member: {
          id: updatedMemberPackage.Member.id,
          name: updatedMemberPackage.Member.full_name,
          phone: updatedMemberPackage.Member.phone_number
        },
        package: {
          id: updatedMemberPackage.Package.id,
          name: updatedMemberPackage.Package.name,
          type: updatedMemberPackage.Package.type
        },
        sessions: {
          group: {
            remaining: updatedMemberPackage.remaining_group_session || 0,
            used: updatedMemberPackage.used_group_session || 0,
            total: totalGroupSessions
          },
          semi_private: {
            remaining: updatedMemberPackage.remaining_semi_private_session || 0,
            used: updatedMemberPackage.used_semi_private_session || 0,
            total: totalSemiPrivateSessions
          },
          private: {
            remaining: updatedMemberPackage.remaining_private_session || 0,
            used: updatedMemberPackage.used_private_session || 0,
            total: totalPrivateSessions
          }
        },
        dates: {
          start_date: updatedMemberPackage.start_date,
          end_date: updatedMemberPackage.end_date
        },
        updated_at: updatedMemberPackage.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating member package:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export member data dengan informasi lengkap
const exportMemberData = async (req, res) => {
  try {
    const { status, format = 'excel' } = req.query;

    // Build where clause
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    // Get all members dengan data lengkap
    console.log('🔍 Query members with whereClause:', whereClause);
    const members = await Member.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['email']
        },
        {
          model: MemberPackage,
          include: [
            {
              model: Package,
              attributes: ['name', 'type']
            }
          ]
        },
        {
          model: Booking,
          include: [
            {
              model: Schedule,
              include: [
                {
                  model: Class,
                  attributes: ['class_name']
                },
                {
                  model: Trainer,
                  attributes: ['title']
                }
              ]
            },
            {
              model: Package,
              attributes: ['name']
            }
          ],
          where: {
            status: 'signup' // Hanya booking yang berhasil (bukan cancelled)
          },
          order: [['createdAt', 'DESC']],
          required: false // Jangan require booking, ambil semua member
        }
      ],
      order: [['full_name', 'ASC']]
    });

    console.log(`📊 Found ${members.length} members in database`);
    members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.full_name} - Packages: ${member.MemberPackages.length}, Bookings: ${member.Bookings.length}`);
    });

    // Format data untuk Excel - 1 row per paket dengan data member di-merge
    const excelData = [];
    let rowNumber = 1;

    members.forEach(member => {
      // Ambil semua paket member
      const allPackages = member.MemberPackages;

      // Data member yang sama untuk semua paket
      const memberData = {
        'Nama Member': member.full_name || '-',
        'Email': member.User?.email || '-',
        'Nomor Telepon': member.phone_number || '-',
        'Status Member': member.status || 'NonAktif',
        'Tanggal Bergabung': member.date_of_join ? new Date(member.date_of_join).toLocaleDateString('id-ID') : '-'
      };

      // Jika member tidak punya paket, buat 1 row dengan data member saja
      if (allPackages.length === 0) {
        excelData.push({
          'No': rowNumber++,
          ...memberData,
          'Nama Paket': '-',
          'Jenis Paket': '-',
          'Status Paket': '-',
          'Tanggal Mulai': '-',
          'Tanggal Expired': '-',
          'Sesi Group': '-',
          'Sesi Semi Private': '-',
          'Sesi Private': '-',
          'Total Sesi': '-',
          'Sesi Terpakai': '-',
          'Sisa Sesi': '-',
          'Harga': '-',
          'Order ID': '-',
          packageCount: 1,
          isFirstPackage: true
        });
      } else {
        // Buat 1 row per paket dengan data member yang sama
        allPackages.forEach((mp, packageIndex) => {
          const currentDate = new Date();
          const endDate = new Date(mp.end_date);
          const startDate = new Date(mp.start_date);
          
          // Hitung status paket
          let packageStatus = 'Belum Aktif';
          if (mp.start_date) {
            if (endDate >= currentDate) {
              packageStatus = 'Aktif';
            } else {
              packageStatus = 'Expired';
            }
          }

          // Hitung total sesi (remaining + used)
          const totalGroupSessions = (mp.remaining_group_session || 0) + (mp.used_group_session || 0);
          const totalSemiPrivateSessions = (mp.remaining_semi_private_session || 0) + (mp.used_semi_private_session || 0);
          const totalPrivateSessions = (mp.remaining_private_session || 0) + (mp.used_private_session || 0);
          const totalSessions = totalGroupSessions + totalSemiPrivateSessions + totalPrivateSessions;

          // Hitung sesi terpakai
          const usedSessions = (mp.used_group_session || 0) + (mp.used_semi_private_session || 0) + (mp.used_private_session || 0);

          // Hitung sisa sesi
          const remainingSessions = (mp.remaining_group_session || 0) + (mp.remaining_semi_private_session || 0) + (mp.remaining_private_session || 0);

          // Format harga dan order
          const priceInfo = mp.Order?.total_amount ? `Rp${mp.Order.total_amount.toLocaleString()}` : '-';
          const orderInfo = mp.order_id || '-';

          excelData.push({
            'No': packageIndex === 0 ? rowNumber : '', // Hanya tampil nomor di row pertama
            'Nama Member': packageIndex === 0 ? memberData['Nama Member'] : '',
            'Email': packageIndex === 0 ? memberData['Email'] : '',
            'Nomor Telepon': packageIndex === 0 ? memberData['Nomor Telepon'] : '',
            'Status Member': packageIndex === 0 ? memberData['Status Member'] : '',
            'Tanggal Bergabung': packageIndex === 0 ? memberData['Tanggal Bergabung'] : '',
            'Nama Paket': mp.Package?.name || '-',
            'Jenis Paket': mp.Package?.type || '-',
            'Status Paket': packageStatus,
            'Tanggal Mulai': mp.start_date ? startDate.toLocaleDateString('id-ID') : '-',
            'Tanggal Expired': mp.end_date ? endDate.toLocaleDateString('id-ID') : '-',
            'Sesi Group': `${mp.remaining_group_session || 0}/${totalGroupSessions}`,
            'Sesi Semi Private': `${mp.remaining_semi_private_session || 0}/${totalSemiPrivateSessions}`,
            'Sesi Private': `${mp.remaining_private_session || 0}/${totalPrivateSessions}`,
            'Total Sesi': totalSessions,
            'Sesi Terpakai': usedSessions,
            'Sisa Sesi': remainingSessions,
            'Harga': priceInfo,
            'Order ID': orderInfo,
            packageCount: allPackages.length,
            isFirstPackage: packageIndex === 0,
            memberIndex: member.id // untuk tracking merge
          });
        });
        
        // Increment row number setelah semua paket member diproses
        rowNumber++;
      }
    });

    console.log(`📋 Generated ${excelData.length} rows for Excel export`);
    
    // Debug: Print structure data
    console.log('📋 Data structure preview:');
    excelData.slice(0, 10).forEach((row, idx) => {
      console.log(`Row ${idx + 1}: Member="${row['Nama Member']}", Package="${row['Nama Paket']}", PackageCount=${row.packageCount}, IsFirst=${row.isFirstPackage}`);
    });

    if (format === 'excel') {
      // Generate Excel file
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data Member');

      // Set header
      const headers = [
        'No', 'Nama Member', 'Email', 
        'Nomor Telepon', 'Status Member', 'Tanggal Bergabung',
        'Nama Paket', 'Jenis Paket', 'Status Paket', 'Tanggal Mulai', 'Tanggal Expired', 
        'Sesi Group', 'Sesi Semi Private', 'Sesi Private', 'Total Sesi', 'Sesi Terpakai', 'Sisa Sesi', 'Harga', 'Order ID'
      ];

      // Add header row
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows dan tracking untuk merge
      let currentRow = 2; // Mulai dari row 2 (setelah header)
      const mergeRanges = []; // Array untuk menyimpan range yang perlu di-merge

      excelData.forEach((row, index) => {
        // Remove metadata sebelum add row
        const { packageCount, isFirstPackage, memberIndex, ...cleanRow } = row;
        
                 const dataRow = worksheet.addRow(Object.values(cleanRow));
         
         // Set alignment untuk kolom nomor (kolom A) - justify left
         const numberCell = dataRow.getCell(1); // Kolom A
         numberCell.alignment = {
           horizontal: 'left',
           vertical: 'middle'
         };
         
         // Apply alternating row colors dengan warna yang lebih lembut
         if (index % 2 === 0) {
           dataRow.fill = {
             type: 'pattern',
             pattern: 'solid',
             fgColor: { argb: 'FFF0F8FF' } // Alice Blue - sangat lembut
           };
         } else {
           dataRow.fill = {
             type: 'pattern',
             pattern: 'solid',
             fgColor: { argb: 'FFE6F3FF' } // Light Blue - lembut
           };
         }
        
        // Track untuk merge range
        if (isFirstPackage && packageCount > 1) {
          const startRow = currentRow;
          const endRow = currentRow + packageCount - 1;
          
          // Simpan range untuk setiap kolom data member (A sampai F)
          const columnNames = ['A', 'B', 'C', 'D', 'E', 'F'];
          columnNames.forEach(colName => {
            mergeRanges.push(`${colName}${startRow}:${colName}${endRow}`);
          });
        }
        
        currentRow++;
      });

      // Apply merge cells menggunakan A1 notation
      mergeRanges.forEach(range => {
        try {
          console.log(`Merging range: ${range}`);
          worksheet.mergeCells(range);
          
          // Set alignment untuk merged cell (ambil cell pertama dari range)
          const firstCell = range.split(':')[0]; // Contoh: A2 dari A2:A4
          const cell = worksheet.getCell(firstCell);
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: 'left',
            wrapText: true 
          };
        } catch (error) {
          console.log(`Error merging range ${range}:`, error.message);
        }
      });

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50); // Min 10, max 50
      });

      // Add border to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="member-data-${new Date().toISOString().split('T')[0]}.xlsx"`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'No,Nama Member,Email,Nomor Telepon,Status Member,Tanggal Bergabung,Nama Paket,Jenis Paket,Status Paket,Tanggal Mulai,Tanggal Expired,Sesi Group,Sesi Semi Private,Sesi Private,Total Sesi,Sesi Terpakai,Sisa Sesi,Harga,Order ID\n';
      const csvRows = excelData.map((row) => {
        // Remove metadata untuk CSV
        const { packageCount, isFirstPackage, memberIndex, ...cleanRow } = row;
        return `${cleanRow['No']},"${cleanRow['Nama Member']}","${cleanRow['Email']}","${cleanRow['Nomor Telepon']}","${cleanRow['Status Member']}","${cleanRow['Tanggal Bergabung']}","${cleanRow['Nama Paket']},"${cleanRow['Jenis Paket']}","${cleanRow['Status Paket']},"${cleanRow['Tanggal Mulai']}","${cleanRow['Tanggal Expired']}","${cleanRow['Sesi Group']}","${cleanRow['Sesi Semi Private']}","${cleanRow['Sesi Private']}","${cleanRow['Total Sesi']}","${cleanRow['Sesi Terpakai']}","${cleanRow['Sisa Sesi']}","${cleanRow['Harga']}","${cleanRow['Order ID']}"`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="member-data-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON format - clean the data first
      const cleanData = excelData.map(row => {
        const { packageCount, isFirstPackage, memberIndex, ...cleanRow } = row;
        return cleanRow;
      });
      
      res.json({
        success: true,
        message: 'Data member berhasil diexport',
        data: cleanData,
        total: cleanData.length,
        export_date: new Date().toISOString(),
        format: format
      });
    }

  } catch (error) {
    logger.error('Error exporting member data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
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
  addPackageToMember,
  extendPackageDuration,
  updateMemberPackage,
  exportMemberData,
 
}; 