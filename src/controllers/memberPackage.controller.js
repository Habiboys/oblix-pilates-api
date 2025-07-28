const { MemberPackage, Package, Order, Payment, Booking, Member, PackageMembership, Category, PackageFirstTrial, PackagePromo, PackageBonus } = require('../models');
const { Op } = require('sequelize');

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

    // Get used sessions for each package from booking table
    const packagesWithUsage = await Promise.all(
      memberPackages.map(async (memberPackage) => {
        // Count used sessions for this specific package from booking table
        const usedSessions = await Booking.count({
          where: {
            member_id,
            package_id: memberPackage.package_id,
            status: 'signup'
          }
        });

        // Get total sessions based on package type
        let totalSessions = 0;
        if (memberPackage.Package?.type === 'membership' && memberPackage.Package?.PackageMembership) {
          totalSessions = memberPackage.Package.PackageMembership.session || 0;
        } else if (memberPackage.Package?.type === 'first_trial' && memberPackage.Package?.PackageFirstTrial) {
          totalSessions = (memberPackage.Package.PackageFirstTrial.group_session || 0) + 
                         (memberPackage.Package.PackageFirstTrial.private_session || 0);
        } else if (memberPackage.Package?.type === 'promo' && memberPackage.Package?.PackagePromo) {
          totalSessions = (memberPackage.Package.PackagePromo.group_session || 0) + 
                         (memberPackage.Package.PackagePromo.private_session || 0);
        } else if (memberPackage.Package?.type === 'bonus' && memberPackage.Package?.PackageBonu) {
          totalSessions = (memberPackage.Package.PackageBonu.group_session || 0) + 
                         (memberPackage.Package.PackageBonu.private_session || 0);
        }
        
        // Calculate progress percentage
        const progressPercentage = totalSessions > 0 ? (usedSessions / totalSessions) * 100 : 0;

        // Get session breakdown for different package types
        let groupSessions = 0;
        let privateSessions = 0;
        
        if (memberPackage.Package?.type === 'membership' && memberPackage.Package?.PackageMembership) {
          // For membership, all sessions are group sessions
          groupSessions = memberPackage.Package.PackageMembership.session || 0;
        } else if (memberPackage.Package?.type === 'first_trial' && memberPackage.Package?.PackageFirstTrial) {
          groupSessions = memberPackage.Package.PackageFirstTrial.group_session || 0;
          privateSessions = memberPackage.Package.PackageFirstTrial.private_session || 0;
        } else if (memberPackage.Package?.type === 'promo' && memberPackage.Package?.PackagePromo) {
          groupSessions = memberPackage.Package.PackagePromo.group_session || 0;
          privateSessions = memberPackage.Package.PackagePromo.private_session || 0;
        } else if (memberPackage.Package?.type === 'bonus' && memberPackage.Package?.PackageBonu) {
          groupSessions = memberPackage.Package.PackageBonu.group_session || 0;
          privateSessions = memberPackage.Package.PackageBonu.private_session || 0;
        }

        // Debug log untuk paket bonus
        if (memberPackage.Package?.type === 'bonus') {
          console.log(`Debug: Bonus package ${memberPackage.Package.name}:`);
          console.log(`  PackageBonu:`, memberPackage.Package.PackageBonu);
          console.log(`  Group sessions: ${groupSessions}`);
          console.log(`  Private sessions: ${privateSessions}`);
        }

        return {
          id: memberPackage.id,
          package_name: memberPackage.Package?.name || (memberPackage.Package?.type === 'bonus' ? 'Paket Bonus' : 'Unknown Package'),
          package_type: memberPackage.Package?.type || 'unknown',
          start_date: memberPackage.start_date,
          end_date: memberPackage.end_date,
          total_session: totalSessions,
          used_session: usedSessions,
          remaining_session: Math.max(0, totalSessions - usedSessions),
          progress_percentage: Math.round(progressPercentage),
          group_sessions: groupSessions,
          private_sessions: privateSessions,
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
      })
    );

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