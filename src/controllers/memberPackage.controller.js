const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Category, Order, Booking } = require('../models');
const { calculateAvailableSessions, updateAllMemberPackagesSessionUsage, getTotalAvailableSessions, getAllMemberPackagesByPriority } = require('../utils/sessionTrackingUtils');

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

    // Get total available sessions from all packages
    const totalAvailableSessions = await getTotalAvailableSessions(member_id);
    
    // Get all member packages sorted by priority for history
    const allMemberPackages = await getAllMemberPackagesByPriority(member_id);
    
    // Calculate total sessions owned by member (not just remaining)
    const totalSessionsOwned = allMemberPackages.reduce((total, memberPackage) => {
      const groupTotal = memberPackage.group_sessions || 0;
      const semiPrivateTotal = memberPackage.semi_private_sessions || 0;
      const privateTotal = memberPackage.private_sessions || 0;
      return {
        group: total.group + groupTotal,
        semi_private: total.semi_private + semiPrivateTotal,
        private: total.private + privateTotal,
        all: total.all + groupTotal + semiPrivateTotal + privateTotal
      };
    }, { group: 0, semi_private: 0, private: 0, all: 0 });

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
          const currentDate = new Date();
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

    // Remove old package history logic since we're using new approach

    // Process packages for history (sorted by priority)
    const packageHistory = allMemberPackages
      .filter(memberPackage => {
        // Include paket yang memiliki order paid ATAU paket bonus
        const hasValidOrder = memberPackage.Order?.payment_status === 'paid';
        const isBonusPackage = memberPackage.Package?.type === 'bonus';
        return hasValidOrder || isBonusPackage;
      })
      .map((memberPackage, index) => {
        // Calculate session details for this package using member package data
        const groupSessions = memberPackage.group_sessions || 0;
        const semiPrivateSessions = memberPackage.semi_private_sessions || 0;
        const privateSessions = memberPackage.private_sessions || 0;
        const totalSessions = groupSessions + semiPrivateSessions + privateSessions;
        
        const usedGroupSessions = memberPackage.used_group_session || 0;
        const usedSemiPrivateSessions = memberPackage.used_semi_private_session || 0;
        const usedPrivateSessions = memberPackage.used_private_session || 0;
        const usedSessions = usedGroupSessions + usedSemiPrivateSessions + usedPrivateSessions;
        
        const remainingGroupSessions = memberPackage.remaining_group_session || 0;
        const remainingSemiPrivateSessions = memberPackage.remaining_semi_private_session || 0;
        const remainingPrivateSessions = memberPackage.remaining_private_session || 0;
        const remainingSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;
        
        const progressPercentage = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * 100) : 0;

        return {
          no: index + 1,
          package_name: memberPackage.Package?.name || 'Unknown Package',
          package_type: memberPackage.Package?.type || 'unknown',
          start_date: memberPackage.start_date,
          expired_date: memberPackage.end_date,
          total_session: totalSessions,
          used_session: usedSessions,
          remaining_session: remainingSessions,
          progress_percentage: progressPercentage,
          group_sessions: {
            total: groupSessions,
            used: usedGroupSessions,
            remaining: remainingGroupSessions
          },
          semi_private_sessions: {
            total: semiPrivateSessions,
            used: usedSemiPrivateSessions,
            remaining: remainingSemiPrivateSessions
          },
          private_sessions: {
            total: privateSessions,
            used: usedPrivateSessions,
            remaining: remainingPrivateSessions
          }
        };
      });

    // Format response with total sessions and package history
    const response = {
      success: true,
      message: 'My packages retrieved successfully',
      data: {
        total_sessions: {
          total: totalSessionsOwned.all,
          used: totalAvailableSessions.used_all_sessions,
          remaining: totalAvailableSessions.remaining_all_sessions
        },
        group_sessions: {
          total: totalSessionsOwned.group,
          used: totalAvailableSessions.used_group_sessions,
          remaining: totalAvailableSessions.remaining_group_sessions
        },
        semi_private_sessions: {
          total: totalSessionsOwned.semi_private,
          used: totalAvailableSessions.used_semi_private_sessions,
          remaining: totalAvailableSessions.remaining_semi_private_sessions
        },
        private_sessions: {
          total: totalSessionsOwned.private,
          used: totalAvailableSessions.used_private_sessions,
          remaining: totalAvailableSessions.remaining_private_sessions
        },
        active_package: packageHistory
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