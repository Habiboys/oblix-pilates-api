const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Category, Order, Booking } = require('../models');
const { calculateAvailableSessions, updateAllMemberPackagesSessionUsage } = require('../utils/sessionTrackingUtils');

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

    // Get current active package (end_date >= today)
    const currentDate = new Date();
    const activePackage = memberPackages.find(mp => {
      const isNotExpired = new Date(mp.end_date) >= currentDate;
      const hasValidOrder = mp.Order?.payment_status === 'paid';
      const isBonusPackage = mp.Package?.type === 'bonus';
      
      // Paket aktif jika: tidak expired DAN (memiliki order yang paid ATAU adalah paket bonus)
      return isNotExpired && (hasValidOrder || isBonusPackage);
    });

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
        invoice_number: pkg.order.invoice_number || 'BONUS-PACKAGE',
        payment_date: pkg.order.payment_date || pkg.start_date,
        expired_date: pkg.end_date,
        package_name: pkg.package_name,
        session_count: pkg.total_session,
        price: pkg.order.total_amount || '0.00',
        order_id: pkg.order.id || null
      }));

    // Format response
    const response = {
      success: true,
      message: 'My packages retrieved successfully',
      data: {
        current_active_package: currentActivePackage ? {
          package_name: currentActivePackage.package_name || (currentActivePackage.package_type === 'bonus' ? 'Paket Bonus' : 'Unknown Package'),
          validity_until: currentActivePackage.end_date,
          session_group_classes: {
            used: currentActivePackage.used_group_session || 0,
            total: currentActivePackage.group_sessions,
            remaining: currentActivePackage.remaining_group_session || 0,
            progress_percentage: currentActivePackage.group_sessions > 0 ? 
              Math.round(((currentActivePackage.used_group_session || 0) / currentActivePackage.group_sessions) * 100) : 0
          },
          session_semi_private_classes: {
            used: currentActivePackage.used_semi_private_session || 0,
            total: currentActivePackage.semi_private_sessions,
            remaining: currentActivePackage.remaining_semi_private_session || 0,
            progress_percentage: currentActivePackage.semi_private_sessions > 0 ? 
              Math.round(((currentActivePackage.used_semi_private_session || 0) / currentActivePackage.semi_private_sessions) * 100) : 0
          },
          session_private_classes: {
            used: currentActivePackage.used_private_session || 0,
            total: currentActivePackage.private_sessions,
            remaining: currentActivePackage.remaining_private_session || 0,
            progress_percentage: currentActivePackage.private_sessions > 0 ? 
              Math.round(((currentActivePackage.used_private_session || 0) / currentActivePackage.private_sessions) * 100) : 0
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