const { Schedule, Class, Trainer, Booking, MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Category } = require('../models');
const { Op } = require('sequelize');
const { sortPackagesByPriority } = require('../utils/sessionUtils');

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
      private: 0
    };

    if (memberPackages.length > 0) {
      // Gunakan utility function untuk mengurutkan paket berdasarkan prioritas
      const sortedPackages = sortPackagesByPriority(memberPackages);
      priorityPackage = sortedPackages[0];

      if (priorityPackage) {
        // Calculate remaining sessions based on package type
        const package = priorityPackage.Package;
        
        if (package.PackageMembership && package.PackageMembership.Category) {
          const categoryName = package.PackageMembership.Category.category_name.toLowerCase();
          const sessionCount = package.PackageMembership.session || 0;
          
          if (categoryName.includes('group') || categoryName.includes('semi')) {
            remainingSessions.group = priorityPackage.remaining_group_session || 0;
          } else if (categoryName.includes('private')) {
            remainingSessions.private = priorityPackage.remaining_private_session || 0;
          }
        } else if (package.PackageFirstTrial) {
          remainingSessions.group = priorityPackage.remaining_group_session || 0;
          remainingSessions.private = priorityPackage.remaining_private_session || 0;
        } else if (package.PackagePromo) {
          remainingSessions.group = priorityPackage.remaining_group_session || 0;
          remainingSessions.private = priorityPackage.remaining_private_session || 0;
        } else if (package.PackageBonus) {
          remainingSessions.group = priorityPackage.remaining_group_session || 0;
          remainingSessions.private = priorityPackage.remaining_private_session || 0;
        }
      }
    }

    // Get schedules for the selected date
    const schedules = await Schedule.findAll({
      where: {
        date_start: selectedDate.toISOString().split('T')[0]
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
          scheduleType = 'group'; // Semi-private uses group session
        }

        // Check if member can book this schedule
        let canBook = false;
        let availableSessions = 0;
        
        if (priorityPackage) {
          if (scheduleType === 'group') {
            availableSessions = remainingSessions.group;
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

        return {
          id: schedule.id,
          date: schedule.date,
          time_start: schedule.time_start,
          time_end: schedule.time_end,
          class: {
            id: schedule.Class?.id,
            name: schedule.Class?.class_name,
            type: schedule.type
          },
          trainer: {
            id: schedule.Trainer?.id,
            name: schedule.Trainer?.title
          },
          capacity: schedule.capacity,
          booked_count: bookedCount,
          available_slots: schedule.capacity - bookedCount,
          schedule_type: scheduleType,
          can_book: canBook && !isBooked,
          is_booked: isBooked,
          booking_status: existingBooking?.status || null,
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