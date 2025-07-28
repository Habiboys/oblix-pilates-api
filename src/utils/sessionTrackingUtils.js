const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Booking, Schedule } = require('../models');
const { Op } = require('sequelize');

/**
 * Update session usage untuk member package
 * @param {string} memberPackageId - ID member package
 * @param {string} memberId - ID member
 * @param {string} packageId - ID package
 */
const updateSessionUsage = async (memberPackageId, memberId, packageId) => {
  try {
    // Ambil data package untuk mengetahui total session
    const package = await Package.findByPk(packageId, {
      include: [
        { model: PackageMembership },
        { model: PackageFirstTrial },
        { model: PackagePromo },
        { model: PackageBonus }
      ]
    });

    if (!package) {
      throw new Error('Package not found');
    }

    // Hitung total session berdasarkan tipe package
    let totalGroupSessions = 0;
    let totalPrivateSessions = 0;

    if (package.type === 'membership' && package.PackageMembership) {
      totalGroupSessions = package.PackageMembership.session || 0;
    } else if (package.type === 'first_trial' && package.PackageFirstTrial) {
      totalGroupSessions = package.PackageFirstTrial.group_session || 0;
      totalPrivateSessions = package.PackageFirstTrial.private_session || 0;
    } else if (package.type === 'promo' && package.PackagePromo) {
      totalGroupSessions = package.PackagePromo.group_session || 0;
      totalPrivateSessions = package.PackagePromo.private_session || 0;
    } else if (package.type === 'bonus' && package.PackageBonu) {
      totalGroupSessions = package.PackageBonu.group_session || 0;
      totalPrivateSessions = package.PackageBonu.private_session || 0;
    }

    // Hitung used sessions dari booking
    const bookings = await Booking.findAll({
      where: {
        member_id: memberId,
        package_id: packageId,
        status: 'signup'
      },
      include: [
        {
          model: Schedule,
          attributes: ['type']
        }
      ]
    });

    let usedGroupSessions = 0;
    let usedPrivateSessions = 0;

    bookings.forEach(booking => {
      if (booking.Schedule) {
        if (booking.Schedule.type === 'group') {
          usedGroupSessions++;
        } else if (booking.Schedule.type === 'private') {
          usedPrivateSessions++;
        } else if (booking.Schedule.type === 'semi_private') {
          // Semi-private bisa dihitung sebagai group atau private tergantung kebijakan
          usedGroupSessions++; // Default sebagai group
        }
      }
    });

    // Hitung remaining sessions
    const remainingGroupSessions = Math.max(0, totalGroupSessions - usedGroupSessions);
    const remainingPrivateSessions = Math.max(0, totalPrivateSessions - usedPrivateSessions);

    // Update member package
    await MemberPackage.update({
      used_group_session: usedGroupSessions,
      used_private_session: usedPrivateSessions,
      remaining_group_session: remainingGroupSessions,
      remaining_private_session: remainingPrivateSessions
    }, {
      where: { id: memberPackageId }
    });

    return {
      total_group: totalGroupSessions,
      total_private: totalPrivateSessions,
      used_group: usedGroupSessions,
      used_private: usedPrivateSessions,
      remaining_group: remainingGroupSessions,
      remaining_private: remainingPrivateSessions
    };

  } catch (error) {
    console.error('Error updating session usage:', error);
    throw error;
  }
};

/**
 * Update session usage untuk semua member packages
 * @param {string} memberId - ID member
 */
const updateAllMemberPackagesSessionUsage = async (memberId) => {
  try {
    const memberPackages = await MemberPackage.findAll({
      where: { member_id: memberId }
    });

    const results = [];
    for (const memberPackage of memberPackages) {
      const result = await updateSessionUsage(
        memberPackage.id,
        memberId,
        memberPackage.package_id
      );
      results.push({
        member_package_id: memberPackage.id,
        ...result
      });
    }

    return results;
  } catch (error) {
    console.error('Error updating all member packages session usage:', error);
    throw error;
  }
};

/**
 * Check if member has available sessions for specific schedule type
 * @param {string} memberId - ID member
 * @param {string} scheduleType - 'group', 'private', atau 'semi_private'
 * @param {string} packageId - ID package (optional, jika tidak ada akan cek semua paket aktif)
 */
const checkAvailableSessions = async (memberId, scheduleType, packageId = null) => {
  try {
    const whereClause = { member_id: memberId };
    if (packageId) {
      whereClause.package_id = packageId;
    }

    const memberPackages = await MemberPackage.findAll({
      where: whereClause,
      include: [
        {
          model: Package,
          where: { type: { [Op.ne]: 'membership' } }, // Exclude membership packages
          required: false
        }
      ]
    });

    let totalAvailable = 0;
    let packageDetails = [];

    for (const memberPackage of memberPackages) {
      let available = 0;
      
      if (scheduleType === 'group') {
        available = memberPackage.remaining_group_session;
      } else if (scheduleType === 'private') {
        available = memberPackage.remaining_private_session;
      } else if (scheduleType === 'semi_private') {
        // Semi-private bisa menggunakan group atau private session
        available = Math.max(
          memberPackage.remaining_group_session,
          memberPackage.remaining_private_session
        );
      }

      totalAvailable += available;
      
      if (available > 0) {
        packageDetails.push({
          member_package_id: memberPackage.id,
          package_name: memberPackage.Package?.name || 'Unknown Package',
          available_sessions: available
        });
      }
    }

    return {
      has_available: totalAvailable > 0,
      total_available: totalAvailable,
      package_details: packageDetails
    };

  } catch (error) {
    console.error('Error checking available sessions:', error);
    throw error;
  }
};

module.exports = {
  updateSessionUsage,
  updateAllMemberPackagesSessionUsage,
  checkAvailableSessions
}; 