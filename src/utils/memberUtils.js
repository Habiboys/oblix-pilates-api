const { 
  Member, 
  MemberPackage, 
  Package, 
  PackageMembership, 
  PackageFirstTrial,
  PackagePromo,
  PackageBonus,
  Booking, 
  Category,
  Schedule
} = require('../models');
const { Op } = require('sequelize');

// Generate unique member code
const generateMemberCode = async () => {
  const prefix = 'MBR';
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  // Get the latest member code for this year
  const latestMember = await Member.findOne({
    where: {
      member_code: {
        [Op.like]: `${prefix}${currentYear}%`
      }
    },
    order: [['member_code', 'DESC']]
  });

  let sequence = 1;
  
  if (latestMember && latestMember.member_code) {
    // Extract sequence number from existing code
    const existingSequence = parseInt(latestMember.member_code.slice(-4));
    sequence = existingSequence + 1;
  }

  // Format: MBR + YY + 4-digit sequence (e.g., MBR240001)
  const memberCode = `${prefix}${currentYear}${sequence.toString().padStart(4, '0')}`;
  
  return memberCode;
};

// Calculate member session statistics
const calculateMemberSessionStats = async (memberId) => {
  try {
    // Get all active member packages
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
            {
              model: PackageMembership,
              include: [
                {
                  model: Category
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
        }
      ]
    });

    let totalSessions = 0;
    let totalUsedSessions = 0;
    let sessionBreakdown = {
      group: { total: 0, used: 0, remaining: 0 },
      semi_private: { total: 0, used: 0, remaining: 0 },
      private: { total: 0, used: 0, remaining: 0 }
    };

    // Calculate total sessions from packages
    for (const memberPackage of memberPackages) {
      const package = memberPackage.Package;
      
      // Check membership package
      if (package.PackageMembership && package.PackageMembership.Category && package.PackageMembership.Category.name) {
        const sessionCount = package.PackageMembership.session || 0;
        const categoryName = package.PackageMembership.Category.name.toLowerCase();
        
        totalSessions += sessionCount;
        
        // Add to breakdown based on category
        if (categoryName.includes('group')) {
          sessionBreakdown.group.total += sessionCount;
        } else if (categoryName.includes('semi') || categoryName.includes('semi-private')) {
          sessionBreakdown.semi_private.total += sessionCount;
        } else if (categoryName.includes('private')) {
          sessionBreakdown.private.total += sessionCount;
        }
      }
      
      // Check first trial package
      if (package.PackageFirstTrial) {
        const groupSessions = package.PackageFirstTrial.group_session || 0;
        const privateSessions = package.PackageFirstTrial.private_session || 0;
        
        totalSessions += groupSessions + privateSessions;
        sessionBreakdown.group.total += groupSessions;
        sessionBreakdown.private.total += privateSessions;
      }
      
      // Check promo package
      if (package.PackagePromo) {
        const groupSessions = package.PackagePromo.group_session || 0;
        const privateSessions = package.PackagePromo.private_session || 0;
        
        totalSessions += groupSessions + privateSessions;
        sessionBreakdown.group.total += groupSessions;
        sessionBreakdown.private.total += privateSessions;
      }
      
      // Check bonus package
      if (package.PackageBonus) {
        const groupSessions = package.PackageBonus.group_session || 0;
        const privateSessions = package.PackageBonus.private_session || 0;
        
        totalSessions += groupSessions + privateSessions;
        sessionBreakdown.group.total += groupSessions;
        sessionBreakdown.private.total += privateSessions;
      }
    }

    // Get used sessions from bookings
    const bookings = await Booking.findAll({
      where: {
        member_id: memberId,
        status: 'signup',
        attendance: 'present'
      },
      include: [
        {
          model: Package,
          include: [
            {
              model: PackageMembership,
              include: [
                {
                  model: Category
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
        },
        {
          model: Schedule,
          as: 'Schedule'
        }
      ]
    });

    // Calculate used sessions
    for (const booking of bookings) {
      const package = booking.Package;
      const scheduleType = booking.Schedule?.type || 'group'; // Default to group if no schedule info
      
      totalUsedSessions += 1;
      
      // Check membership package
      if (package.PackageMembership && package.PackageMembership.Category && package.PackageMembership.Category.name) {
        const categoryName = package.PackageMembership.Category.name.toLowerCase();
        
        // Add to breakdown based on category
        if (categoryName.includes('group')) {
          sessionBreakdown.group.used += 1;
        } else if (categoryName.includes('semi') || categoryName.includes('semi-private')) {
          sessionBreakdown.semi_private.used += 1;
        } else if (categoryName.includes('private')) {
          sessionBreakdown.private.used += 1;
        }
      } else {
        // For non-membership packages, use schedule type
        if (scheduleType === 'group') {
          sessionBreakdown.group.used += 1;
        } else if (scheduleType === 'semi_private') {
          sessionBreakdown.semi_private.used += 1;
        } else if (scheduleType === 'private') {
          sessionBreakdown.private.used += 1;
        }
      }
    }

    // Calculate remaining sessions
    sessionBreakdown.group.remaining = sessionBreakdown.group.total - sessionBreakdown.group.used;
    sessionBreakdown.semi_private.remaining = sessionBreakdown.semi_private.total - sessionBreakdown.semi_private.used;
    sessionBreakdown.private.remaining = sessionBreakdown.private.total - sessionBreakdown.private.used;

    const totalRemainingSessions = totalSessions - totalUsedSessions;

    return {
      totalSessions,
      totalUsedSessions,
      totalRemainingSessions,
      sessionBreakdown
    };
  } catch (error) {
    console.error('Error calculating member session stats:', error);
    return {
      totalSessions: 0,
      totalUsedSessions: 0,
      totalRemainingSessions: 0,
      sessionBreakdown: {
        group: { total: 0, used: 0, remaining: 0 },
        semi_private: { total: 0, used: 0, remaining: 0 },
        private: { total: 0, used: 0, remaining: 0 }
      }
    };
  }
};

module.exports = {
  generateMemberCode,
  calculateMemberSessionStats
}; 