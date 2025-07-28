const { Op } = require('sequelize');
const { Schedule, Class, Trainer, Booking, Member, Package, MemberPackage, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Category } = require('../models');
const { calculateAvailableSessions, updateAllMemberPackagesSessionUsage } = require('../utils/sessionTrackingUtils');
const logger = require('../config/logger');

// Get available classes for a specific date
const getAvailableClasses = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.id; // User ID from token

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    // Validate date format
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get member ID from user ID
    const { Member } = require('../models');
    const member = await Member.findOne({
      where: { user_id: userId }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const memberId = member.id;

    // Update session usage untuk semua member packages terlebih dahulu
    await updateAllMemberPackagesSessionUsage(memberId);

    // Get member's active packages with priority
    const memberPackages = await MemberPackage.findAll({
      where: {
        member_id: memberId,
        end_date: {
          [Op.gte]: new Date().toISOString().split('T')[0] // Not expired
        }
      },
      include: [
        {
          model: Package,
          include: [
            { model: PackageMembership, include: [{ model: Category }] },
            { model: PackageFirstTrial },
            { model: PackagePromo },
            { model: PackageBonus }
          ]
        }
      ],
      order: [
        // Priority order: bonus > promo > trial > membership
        [{ model: Package }, 'type', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    // Determine priority package and remaining sessions
    let priorityPackage = null;
    let remainingSessions = {
      group: 0,
      semi_private: 0,
      private: 0
    };

    if (memberPackages.length > 0) {
      // Gunakan calculateAvailableSessions untuk mendapatkan paket yang konsisten
      const sessionInfo = await calculateAvailableSessions(memberId);
      
      if (sessionInfo.packageDetails.length > 0) {
        // Ambil paket dengan prioritas tertinggi (bonus > promo > first_trial > membership)
        const priorityPackageDetail = sessionInfo.packageDetails[0];
        
        // Cari member package yang sesuai
        priorityPackage = memberPackages.find(mp => mp.package_id === priorityPackageDetail.package_id);
        
        if (priorityPackage) {
          remainingSessions.group = priorityPackage.remaining_group_session || 0;
          remainingSessions.semi_private = priorityPackage.remaining_semi_private_session || 0;
          remainingSessions.private = priorityPackage.remaining_private_session || 0;
        }
      }
    }

    // Get schedules for the selected date (exclude private schedules)
    const schedules = await Schedule.findAll({
      where: {
        date_start: selectedDate.toISOString().split('T')[0],
        type: {
          [Op.in]: ['group', 'semi_private'] // Exclude private schedules
        }
      },
      include: [
        {
          model: Class
        },
        {
          model: Trainer
        }
      ],
      order: [
        ['time_start', 'ASC']
      ]
    });

    // Calculate availability for each schedule
    const schedulesWithAvailability = await Promise.all(
      schedules.map(async (schedule) => {
        // Count existing bookings for this schedule
        const bookedCount = await Booking.count({
          where: {
            schedule_id: schedule.id,
            status: {
              [Op.in]: ['signup', 'waiting_list']
            }
          }
        });

        // Determine schedule type for session calculation
        let scheduleType = 'group';
        if (schedule.type === 'private') {
          scheduleType = 'private';
        } else if (schedule.type === 'semi_private') {
          scheduleType = 'semi_private'; // Semi-private uses semi_private session
        }

        // Check if member can book this schedule
        let canBook = false;
        let availableSessions = 0;
        
        if (priorityPackage) {
          if (scheduleType === 'group') {
            availableSessions = remainingSessions.group;
          } else if (scheduleType === 'semi_private') {
            availableSessions = remainingSessions.semi_private;
          } else if (scheduleType === 'private') {
            availableSessions = remainingSessions.private;
          }
          canBook = availableSessions > 0;
        }

        // Check if member already booked this schedule
        const existingBooking = await Booking.findOne({
          where: {
            schedule_id: schedule.id,
            member_id: memberId,
            status: {
              [Op.in]: ['signup', 'waiting_list']
            }
          }
        });

        const isBooked = !!existingBooking;

        // Calculate available slots with proper fallback
        const capacity = schedule.pax || 20; // Use pax field or default to 20
        const availableSlots = Math.max(0, capacity - bookedCount);

        return {
          id: schedule.id,
          date: schedule.date_start,
          time_start: schedule.time_start,
          time_end: schedule.time_end,
          class: {
            id: schedule.Class?.id,
            name: schedule.Class?.class_name,
            type: schedule.Class?.type || 'group'
          },
          trainer: {
            id: schedule.Trainer?.id,
            name: schedule.Trainer?.title
          },
          capacity: capacity,
          booked_count: bookedCount,
          available_slots: availableSlots,
          schedule_type: schedule.type, // Use actual schedule type
          can_book: canBook && !isBooked,
          is_booked: isBooked,
          booking_status: existingBooking?.status || null,
          booking_id: existingBooking?.id || null, // Tambahkan booking_id
          available_sessions: availableSessions
        };
      })
    );

    // Get package info for display
    let packageInfo = null;
    if (priorityPackage) {
      const package = priorityPackage.Package;
      let packageName = 'Unknown Package';
      let packageType = package.type;
      let packageDetails = '';

      if (package.PackageMembership && package.PackageMembership.Category) {
        packageName = package.PackageMembership.Category.category_name;
        packageDetails = `${package.PackageMembership.session} sessions`;
      } else if (package.PackageFirstTrial) {
        packageName = 'First Trial Package';
        const groupSessions = package.PackageFirstTrial.group_session || 0;
        const privateSessions = package.PackageFirstTrial.private_session || 0;
        packageDetails = `${groupSessions} group + ${privateSessions} private sessions`;
      } else if (package.PackagePromo) {
        packageName = package.name || 'Promo Package';
        const groupSessions = package.PackagePromo.group_session || 0;
        const privateSessions = package.PackagePromo.private_session || 0;
        packageDetails = `${groupSessions} group + ${privateSessions} private sessions`;
      } else if (package.PackageBonus) {
        packageName = package.name || 'Bonus Package';
        const groupSessions = package.PackageBonus.group_session || 0;
        const privateSessions = package.PackageBonus.private_session || 0;
        packageDetails = `${groupSessions} group + ${privateSessions} private sessions`;
      }

      // Calculate days remaining
      const today = new Date();
      const endDate = new Date(priorityPackage.end_date);
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      packageInfo = {
        package_id: priorityPackage.package_id,
        package_name: packageName,
        package_type: packageType,
        package_details: packageDetails,
        remaining_sessions: remainingSessions,
        end_date: priorityPackage.end_date,
        days_remaining: daysRemaining,
        total_sessions: {
          group: (priorityPackage.remaining_group_session || 0) + (priorityPackage.used_group_session || 0),
          private: (priorityPackage.remaining_private_session || 0) + (priorityPackage.used_private_session || 0)
        }
      };
    }

    res.json({
      success: true,
      message: 'Available classes retrieved successfully',
      data: {
        date: selectedDate.toISOString().split('T')[0],
        package_info: packageInfo,
        schedules: schedulesWithAvailability
      }
    });

  } catch (error) {
    console.error('Error getting available classes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAvailableClasses
}; 