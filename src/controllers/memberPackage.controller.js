const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Category, Order, Booking } = require('../models');
const { calculateAvailableSessions, updateAllMemberPackagesSessionUsage, getCurrentActivePackage } = require('../utils/sessionTrackingUtils');

const getMyPackages = async (req, res) => {
  try {
    const member_id = req.user.member_id;

    // Check if user is a member
    if (!member_id) {
      return res.status(403).json({
        success: false,
        message: 'Only members can view packages'
      });
    }

    // Update session usage untuk semua member packages terlebih dahulu
    await updateAllMemberPackagesSessionUsage(member_id);

    // Get all member packages with related data
    const memberPackages = await MemberPackage.findAll({
      where: { member_id },
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'type', 'price', 'duration_value', 'duration_unit'],
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
        },
        {
          model: Order,
          attributes: ['id', 'order_number', 'paid_at', 'total_amount', 'payment_status']
        }
      ],
      order: [['end_date', 'DESC']]
    });

    // Get current active package using priority system
    const priorityActivePackage = await getCurrentActivePackage(member_id);

    // Process packages with updated session data
    const packagesWithUsage = memberPackages.map((memberPackage) => {
      // Get total sessions based on package type
      let totalSessions = 0;
      let groupSessions = 0;
      let semiPrivateSessions = 0;
      let privateSessions = 0;
      
      if (memberPackage.Package?.type === 'membership' && memberPackage.Package?.PackageMembership) {
        // Untuk membership, session type ditentukan oleh category
        const categoryName = memberPackage.Package.PackageMembership.Category?.category_name;
        const sessionCount = memberPackage.Package.PackageMembership.session || 0;
        
        if (categoryName === 'Semi-Private Class') {
          semiPrivateSessions = sessionCount;
          totalSessions = sessionCount;
        } else if (categoryName === 'Private Class') {
          privateSessions = sessionCount;
          totalSessions = sessionCount;
        } else {
          // Default ke group (termasuk 'Group Class' atau category lain)
          groupSessions = sessionCount;
          totalSessions = sessionCount;
        }
      } else if (memberPackage.Package?.type === 'first_trial' && memberPackage.Package?.PackageFirstTrial) {
        groupSessions = memberPackage.Package.PackageFirstTrial.group_session || 0;
        privateSessions = memberPackage.Package.PackageFirstTrial.private_session || 0;
        totalSessions = groupSessions + privateSessions;
      } else if (memberPackage.Package?.type === 'promo' && memberPackage.Package?.PackagePromo) {
        groupSessions = memberPackage.Package.PackagePromo.group_session || 0;
        privateSessions = memberPackage.Package.PackagePromo.private_session || 0;
        totalSessions = groupSessions + privateSessions;
      } else if (memberPackage.Package?.type === 'bonus' && memberPackage.Package?.PackageBonus) {
        groupSessions = memberPackage.Package.PackageBonus.group_session || 0;
        privateSessions = memberPackage.Package.PackageBonus.private_session || 0;
        totalSessions = groupSessions + privateSessions;
      }

      // Use updated session data from MemberPackage
      const usedGroupSessions = memberPackage.used_group_session || 0;
      const usedSemiPrivateSessions = memberPackage.used_semi_private_session || 0;
      const usedPrivateSessions = memberPackage.used_private_session || 0;
      const remainingGroupSessions = memberPackage.remaining_group_session || 0;
      const remainingSemiPrivateSessions = memberPackage.remaining_semi_private_session || 0;
      const remainingPrivateSessions = memberPackage.remaining_private_session || 0;
      
      // Calculate total used sessions based on package type
      let totalUsedSessions = 0;
      if (memberPackage.Package?.type === 'membership') {
        // Untuk membership, gunakan session type berdasarkan category
        const categoryName = memberPackage.Package.PackageMembership?.Category?.category_name;
        if (categoryName === 'Semi-Private Class') {
          totalUsedSessions = usedSemiPrivateSessions;
        } else if (categoryName === 'Private Class') {
          totalUsedSessions = usedPrivateSessions;
        } else {
          totalUsedSessions = usedGroupSessions;
        }
      } else {
        // Untuk paket lain, jumlahkan group dan private
        totalUsedSessions = usedGroupSessions + usedPrivateSessions;
      }

      const progressPercentage = totalSessions > 0 ? (totalUsedSessions / totalSessions) * 100 : 0;

      return {
        id: memberPackage.id,
        package_name: memberPackage.Package?.name || (memberPackage.Package?.type === 'bonus' ? 'Paket Bonus' : 'Unknown Package'),
        package_type: memberPackage.Package?.type || 'unknown',
        start_date: memberPackage.start_date,
        end_date: memberPackage.end_date,
        total_session: totalSessions,
        used_session: totalUsedSessions,
        remaining_session: Math.max(0, totalSessions - totalUsedSessions),
        progress_percentage: Math.round(progressPercentage),
        group_sessions: groupSessions,
        semi_private_sessions: semiPrivateSessions,
        private_sessions: privateSessions,
        used_group_session: usedGroupSessions,
        used_semi_private_session: usedSemiPrivateSessions,
        used_private_session: usedPrivateSessions,
        remaining_group_session: remainingGroupSessions,
        remaining_semi_private_session: remainingSemiPrivateSessions,
        remaining_private_session: remainingPrivateSessions,
        is_active: (() => {
          const isNotExpired = new Date(memberPackage.end_date) >= currentDate;
          const hasValidOrder = memberPackage.Order?.payment_status === 'paid';
          const isBonusPackage = memberPackage.Package?.type === 'bonus';
          
          return isNotExpired && (hasValidOrder || isBonusPackage);
        })(),
        order: {
          id: memberPackage.Order?.id,
          order_number: memberPackage.Order?.order_number,
          invoice_number: memberPackage.Order?.order_number,
          payment_date: memberPackage.Order?.paid_at,
          total_amount: memberPackage.Order?.total_amount,
          payment_status: memberPackage.Order?.payment_status
        }
      };
    });

    // Separate active package and history
    const currentActivePackage = packagesWithUsage.find(pkg => pkg.is_active);
    const packageHistory = packagesWithUsage
      .filter(pkg => {
        // Include paket yang memiliki order paid ATAU paket bonus
        const hasValidOrder = pkg.order.payment_status === 'paid';
        const isBonusPackage = pkg.package_type === 'bonus';
        return hasValidOrder || isBonusPackage;
      })
      .map((pkg, index) => ({
        no: index + 1,
        package_name: pkg.package_name,
        package_type: pkg.package_type,
        start_date: pkg.start_date,
        expired_date: pkg.end_date,
        total_session: pkg.total_session,
        used_session: pkg.used_session,
        remaining_session: pkg.remaining_session,
        progress_percentage: pkg.progress_percentage,
        group_sessions: {
          total: pkg.group_sessions,
          used: pkg.used_group_session,
          remaining: pkg.remaining_group_session
        },
        semi_private_sessions: {
          total: pkg.semi_private_sessions,
          used: pkg.used_semi_private_session,
          remaining: pkg.remaining_semi_private_session
        },
        private_sessions: {
          total: pkg.private_sessions,
          used: pkg.used_private_session,
          remaining: pkg.remaining_private_session
        }
      }));

    // Format response using priority-based active package
    const response = {
      success: true,
      message: 'My packages retrieved successfully',
      data: {
        current_active_package: priorityActivePackage ? {
          package_name: priorityActivePackage.package_name,
          package_type: priorityActivePackage.package_type,
          validity_until: priorityActivePackage.end_date,
          total_session: priorityActivePackage.total_available,
          session_group_classes: {
            total: priorityActivePackage.group_sessions.total,
            used: priorityActivePackage.group_sessions.used,
            remaining: priorityActivePackage.group_sessions.remaining,
            progress_percentage: priorityActivePackage.group_sessions.total > 0 ? 
              Math.round((priorityActivePackage.group_sessions.used / priorityActivePackage.group_sessions.total) * 100) : 0
          },
          session_semi_private_classes: {
            total: priorityActivePackage.semi_private_sessions.total,
            used: priorityActivePackage.semi_private_sessions.used,
            remaining: priorityActivePackage.semi_private_sessions.remaining,
            progress_percentage: priorityActivePackage.semi_private_sessions.total > 0 ? 
              Math.round((priorityActivePackage.semi_private_sessions.used / priorityActivePackage.semi_private_sessions.total) * 100) : 0
          },
          session_private_classes: {
            total: priorityActivePackage.private_sessions.total,
            used: priorityActivePackage.private_sessions.used,
            remaining: priorityActivePackage.private_sessions.remaining,
            progress_percentage: priorityActivePackage.private_sessions.total > 0 ? 
              Math.round((priorityActivePackage.private_sessions.used / priorityActivePackage.private_sessions.total) * 100) : 0
          }
        } : null,
        package_history: packageHistory
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error getting my packages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getMyPackages
}; 