const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Booking, Schedule, Category, Order } = require('../models');
const { Op } = require('sequelize');

/**
 * Mendapatkan skor prioritas paket berdasarkan tipe dan masa berlaku
 * @param {string} packageType - Tipe paket
 * @param {Date} endDate - Tanggal berakhir paket
 * @returns {number} Skor prioritas (semakin tinggi semakin prioritas)
 */
const getPackagePriorityScore = (packageType, endDate) => {
    // Prioritas berdasarkan tipe paket
    const typePriority = {
        'bonus': 4,      // Prioritas tertinggi
        'promo': 3,
        'first_trial': 2,
        'membership': 1   // Prioritas terendah
    };
    
    const baseScore = typePriority[packageType] || 0;
    
    // Tambahkan bonus untuk paket yang akan segera berakhir (prioritas lebih tinggi)
    const today = new Date();
    const daysUntilExpiry = Math.ceil((new Date(endDate) - today) / (1000 * 60 * 60 * 24));
    
    // Paket yang akan berakhir dalam 30 hari mendapat bonus prioritas
    // Semakin sedikit hari tersisa, semakin tinggi prioritasnya
    let expiryBonus = 0;
    if (daysUntilExpiry <= 7) {
        expiryBonus = 50; // Prioritas sangat tinggi untuk paket yang akan berakhir dalam 7 hari
    } else if (daysUntilExpiry <= 14) {
        expiryBonus = 30; // Prioritas tinggi untuk paket yang akan berakhir dalam 14 hari
    } else if (daysUntilExpiry <= 30) {
        expiryBonus = 15; // Prioritas sedang untuk paket yang akan berakhir dalam 30 hari
    }
    
    return baseScore + expiryBonus;
};

/**
 * Mengurutkan paket berdasarkan prioritas
 * @param {Array} packages - Array paket member
 * @returns {Array} Array paket yang sudah diurutkan berdasarkan prioritas
 */
const sortPackagesByPriority = (packages) => {
    return packages.sort((a, b) => {
        const aScore = getPackagePriorityScore(a.Package.type, a.end_date);
        const bScore = getPackagePriorityScore(b.Package.type, b.end_date);
        
        // Urutkan berdasarkan skor (descending - prioritas tertinggi dulu)
        if (aScore !== bScore) {
            return bScore - aScore;
        }
        
        // Jika skor sama, urutkan berdasarkan end_date (yang akan berakhir duluan prioritas lebih tinggi)
        const aEndDate = new Date(a.end_date);
        const bEndDate = new Date(b.end_date);
        return aEndDate - bEndDate;
    });
};

/**
 * Menghitung total sesi yang tersedia untuk member
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Object berisi total sesi dan detail paket
 */
const calculateAvailableSessions = async (memberId) => {
    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const memberPackages = await MemberPackage.findAll({
        where: { 
            member_id: memberId,
            end_date: {
                [Op.gte]: currentDate // Hanya paket yang masih berlaku
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
        ]
    });

    let totalAvailableSessions = 0;
    let packageDetails = [];

    for (const memberPackage of memberPackages) {
        const package = memberPackage.Package;
        let totalSessions = 0;
        let sessionType = 'group'; // default

        // Ambil sesi berdasarkan tipe paket
        switch (package.type) {
            case 'membership':
                if (package.PackageMembership) {
                    totalSessions = package.PackageMembership.session || 0;
                    // Untuk membership, session type ditentukan oleh category
                    const categoryName = package.PackageMembership.Category?.category_name;
                    if (categoryName === 'Semi-Private Class') {
                        sessionType = 'semi_private';
                    } else if (categoryName === 'Private Class') {
                        sessionType = 'private';
                    }
                }
                break;
            case 'first_trial':
                if (package.PackageFirstTrial) {
                    totalSessions = (package.PackageFirstTrial.group_session || 0) + 
                                  (package.PackageFirstTrial.private_session || 0);
                }
                break;
            case 'promo':
                if (package.PackagePromo) {
                    totalSessions = (package.PackagePromo.group_session || 0) + 
                                  (package.PackagePromo.private_session || 0);
                }
                break;
            case 'bonus':
                if (package.PackageBonus) {
                    totalSessions = (package.PackageBonus.group_session || 0) + 
                                  (package.PackageBonus.private_session || 0);
                }
                break;
        }

        // Gunakan remaining sessions yang sudah diupdate di MemberPackage
        let availableSessions = 0;
        if (package.type === 'membership') {
          // Untuk membership, gunakan session type berdasarkan category
          const categoryName = package.PackageMembership.Category?.category_name;
          if (categoryName === 'Semi-Private Class') {
            availableSessions = memberPackage.remaining_semi_private_session || 0;
          } else if (categoryName === 'Private Class') {
            availableSessions = memberPackage.remaining_private_session || 0;
          } else {
            availableSessions = memberPackage.remaining_group_session || 0;
          }
        } else {
          // Untuk paket lain, jumlahkan semua remaining sessions
          availableSessions = (memberPackage.remaining_group_session || 0) + 
                            (memberPackage.remaining_private_session || 0);
        }
        
        const usedSessions = totalSessions - availableSessions;
        
        totalAvailableSessions += availableSessions;

        if (availableSessions > 0) {
            packageDetails.push({
                package_id: package.id,
                package_type: package.type,
                package_name: package.name,
                session_type: sessionType,
                available_sessions: availableSessions,
                total_sessions: totalSessions,
                used_sessions: usedSessions
            });
        }
    }

    return {
        totalAvailableSessions,
        packageDetails,
        hasAvailableSessions: totalAvailableSessions > 0
    };
};

/**
 * Memvalidasi apakah member memiliki jatah sesi yang cukup
 * @param {string} memberId - ID member
 * @param {number} requiredSessions - Jumlah sesi yang dibutuhkan
 * @returns {Promise<Object>} Object berisi hasil validasi
 */
const validateSessionAvailability = async (memberId, requiredSessions) => {
    const sessionInfo = await calculateAvailableSessions(memberId);
    
    const isValid = sessionInfo.totalAvailableSessions >= requiredSessions;
    
    return {
        isValid,
        ...sessionInfo,
        requiredSessions,
        deficit: Math.max(0, requiredSessions - sessionInfo.totalAvailableSessions)
    };
};

/**
 * Mendapatkan paket yang tersedia untuk booking
 * @param {string} memberId - ID member
 * @param {number} requiredSessions - Jumlah sesi yang dibutuhkan
 * @returns {Promise<Array>} Array berisi paket yang bisa digunakan
 */
const getAvailablePackagesForBooking = async (memberId, requiredSessions) => {
    const sessionInfo = await calculateAvailableSessions(memberId);
    
    if (!sessionInfo.hasAvailableSessions) {
        return [];
    }

    // Gunakan fungsi utility untuk mengurutkan paket berdasarkan prioritas
    const sortedPackages = sessionInfo.packageDetails.sort((a, b) => {
        // Prioritas: bonus > promo > first_trial > membership
        const priority = {
            'bonus': 4,      // Prioritas tertinggi
            'promo': 3,
            'first_trial': 2,
            'membership': 1   // Prioritas terendah
        };
        
        const aPriority = priority[a.package_type] || 0;
        const bPriority = priority[b.package_type] || 0;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
        }
        
        // Jika prioritas sama, urutkan berdasarkan nama paket
        return a.package_name.localeCompare(b.package_name);
    });

    return sortedPackages;
};

/**
 * Membuat alokasi sesi untuk booking
 * @param {string} memberId - ID member
 * @param {number} requiredSessions - Jumlah sesi yang dibutuhkan
 * @returns {Promise<Array>} Array berisi alokasi paket untuk setiap sesi
 */
const createSessionAllocation = async (memberId, requiredSessions) => {
    const availablePackages = await getAvailablePackagesForBooking(memberId, requiredSessions);
    
    if (availablePackages.length === 0) {
        throw new Error('Tidak ada paket yang tersedia untuk booking');
    }

    const allocation = [];
    let currentPackageIndex = 0;
    let sessionsUsedInCurrentPackage = 0;

    for (let i = 0; i < requiredSessions; i++) {
        let selectedPackage = availablePackages[currentPackageIndex];
        
        // Jika paket saat ini sudah habis, pindah ke paket berikutnya
        if (sessionsUsedInCurrentPackage >= selectedPackage.available_sessions) {
            currentPackageIndex++;
            sessionsUsedInCurrentPackage = 0;
            selectedPackage = availablePackages[currentPackageIndex];
            
            if (!selectedPackage) {
                throw new Error('Tidak ada paket yang tersedia untuk booking');
            }
        }

        allocation.push({
            sessionIndex: i,
            package_id: selectedPackage.package_id,
            package_type: selectedPackage.package_type,
            package_name: selectedPackage.package_name
        });
        
        sessionsUsedInCurrentPackage++;
    }

    return allocation;
};

/**
 * Mendapatkan ringkasan sesi member
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Ringkasan sesi member
 */
const getMemberSessionSummary = async (memberId) => {
    const sessionInfo = await calculateAvailableSessions(memberId);
    
    return {
        member_id: memberId,
        total_available_sessions: sessionInfo.totalAvailableSessions,
        total_packages: sessionInfo.packageDetails.length,
        packages: sessionInfo.packageDetails.map(pkg => ({
            package_id: pkg.package_id,
            package_name: pkg.package_name,
            package_type: pkg.package_type,
            available_sessions: pkg.available_sessions,
            total_sessions: pkg.total_sessions,
            used_sessions: pkg.used_sessions
        })),
        has_available_sessions: sessionInfo.hasAvailableSessions
    };
};

/**
 * Update session usage untuk member package
 * @param {string} memberPackageId - ID member package
 * @param {string} memberId - ID member
 * @param {string} packageId - ID package
 * @param {string} newBookingId - ID booking yang baru dibuat (optional)
 */
const updateSessionUsage = async (memberPackageId, memberId, packageId, newBookingId = null, sessionType = null) => {
  try {
    // Ambil data package untuk mengetahui total session
    const package = await Package.findByPk(packageId, {
      include: [
        { model: PackageMembership, include: [{ model: Category }] },
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
    let totalSemiPrivateSessions = 0;
    let totalPrivateSessions = 0;

    if (package.type === 'membership' && package.PackageMembership) {
      // Untuk membership, session type ditentukan oleh category
      const categoryName = package.PackageMembership.Category?.category_name;
      const sessionCount = package.PackageMembership.session || 0;
      
      if (categoryName === 'Semi-Private Class') {
        totalSemiPrivateSessions = sessionCount;
      } else if (categoryName === 'Private Class') {
        totalPrivateSessions = sessionCount;
      } else {
        // Default ke group (termasuk 'Group Class' atau category lain)
        totalGroupSessions = sessionCount;
      }
    } else if (package.type === 'first_trial' && package.PackageFirstTrial) {
      totalGroupSessions = package.PackageFirstTrial.group_session || 0;
      totalPrivateSessions = package.PackageFirstTrial.private_session || 0;
    } else if (package.type === 'promo' && package.PackagePromo) {
      totalGroupSessions = package.PackagePromo.group_session || 0;
      totalPrivateSessions = package.PackagePromo.private_session || 0;
    } else if (package.type === 'bonus' && package.PackageBonus) {
      totalGroupSessions = package.PackageBonus.group_session || 0;
      totalPrivateSessions = package.PackageBonus.private_session || 0;
    }

    // Hitung used sessions dari booking
    const bookings = await Booking.findAll({
      where: {
        member_id: memberId,
        package_id: packageId,
        status: 'signup'
      },
      attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Schedule,
          attributes: ['type']
        }
      ]
    });

    let usedGroupSessions = 0;
    let usedSemiPrivateSessions = 0;
    let usedPrivateSessions = 0;

    bookings.forEach(booking => {
      if (booking.Schedule) {
        if (booking.Schedule.type === 'group') {
          usedGroupSessions++;
        } else if (booking.Schedule.type === 'semi_private') {
          usedSemiPrivateSessions++;
        } else if (booking.Schedule.type === 'private') {
          usedPrivateSessions++;
        }
      }
    });

    // Jika ada booking baru, tambahkan ke perhitungan
    if (newBookingId) {
      const newBooking = await Booking.findByPk(newBookingId, {
        include: [
          {
            model: Schedule,
            attributes: ['type']
          }
        ]
      });

      if (newBooking && newBooking.Schedule) {
        if (newBooking.Schedule.type === 'group') {
          usedGroupSessions++;
        } else if (newBooking.Schedule.type === 'semi_private') {
          usedSemiPrivateSessions++;
        } else if (newBooking.Schedule.type === 'private') {
          usedPrivateSessions++;
        }
      }
    }

    // Hitung remaining sessions
    const remainingGroupSessions = Math.max(0, totalGroupSessions - usedGroupSessions);
    const remainingSemiPrivateSessions = Math.max(0, totalSemiPrivateSessions - usedSemiPrivateSessions);
    const remainingPrivateSessions = Math.max(0, totalPrivateSessions - usedPrivateSessions);

    // Update member package
    await MemberPackage.update({
      used_group_session: usedGroupSessions,
      used_semi_private_session: usedSemiPrivateSessions,
      used_private_session: usedPrivateSessions,
      remaining_group_session: remainingGroupSessions,
      remaining_semi_private_session: remainingSemiPrivateSessions,
      remaining_private_session: remainingPrivateSessions
    }, {
      where: { id: memberPackageId }
    });

    return {
      total_group: totalGroupSessions,
      total_semi_private: totalSemiPrivateSessions,
      total_private: totalPrivateSessions,
      used_group: usedGroupSessions,
      used_semi_private: usedSemiPrivateSessions,
      used_private: usedPrivateSessions,
      remaining_group: remainingGroupSessions,
      remaining_semi_private: remainingSemiPrivateSessions,
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

/**
 * Check available sessions for specific schedule type with smart fallback
 * @param {string} memberId - ID member
 * @param {string} scheduleType - 'group', 'private', atau 'semi_private'
 * @returns {Promise<Object>} Object berisi hasil pengecekan dengan fallback
 */
const checkAvailableSessionsWithFallback = async (memberId, scheduleType) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Get all active member packages
    const memberPackages = await MemberPackage.findAll({
      where: { 
        member_id: memberId,
        end_date: {
          [Op.gte]: currentDate
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
      ]
    });

    // Sort packages by priority
    const sortedPackages = sortPackagesByPriority(memberPackages);
    
    let bestPackage = null;
    let bestAvailable = 0;
    let fallbackPackages = [];

    for (const memberPackage of sortedPackages) {
      let available = 0;
      let canHandleScheduleType = false;
      
      // Check if this package can handle the schedule type
      if (scheduleType === 'group') {
        available = memberPackage.remaining_group_session || 0;
        canHandleScheduleType = available > 0;
      } else if (scheduleType === 'private') {
        available = memberPackage.remaining_private_session || 0;
        canHandleScheduleType = available > 0;
      } else if (scheduleType === 'semi_private') {
        // Semi-private can use either group or private sessions
        const groupAvailable = memberPackage.remaining_group_session || 0;
        const privateAvailable = memberPackage.remaining_private_session || 0;
        available = Math.max(groupAvailable, privateAvailable);
        canHandleScheduleType = available > 0;
      }

      if (canHandleScheduleType) {
        if (!bestPackage || available > bestAvailable) {
          // If this is the first package or has more sessions, make it the best
          if (bestPackage) {
            fallbackPackages.push(bestPackage);
          }
          bestPackage = {
            member_package_id: memberPackage.id,
            package_id: memberPackage.package_id,
            package_name: memberPackage.Package?.name || 'Unknown Package',
            package_type: memberPackage.Package?.type || 'unknown',
            available_sessions: available,
            priority_score: getPackagePriorityScore(memberPackage.Package?.type, memberPackage.end_date)
          };
          bestAvailable = available;
        } else {
          fallbackPackages.push({
            member_package_id: memberPackage.id,
            package_id: memberPackage.package_id,
            package_name: memberPackage.Package?.name || 'Unknown Package',
            package_type: memberPackage.Package?.type || 'unknown',
            available_sessions: available,
            priority_score: getPackagePriorityScore(memberPackage.Package?.type, memberPackage.end_date)
          });
        }
      }
    }

    return {
      has_available: bestPackage !== null,
      best_package: bestPackage,
      fallback_packages: fallbackPackages.sort((a, b) => b.priority_score - a.priority_score),
      total_available: bestAvailable
    };

  } catch (error) {
    console.error('Error checking available sessions with fallback:', error);
    throw error;
  }
};

/**
 * Get best package for booking specific schedule type
 * @param {string} memberId - ID member
 * @param {string} scheduleType - 'group', 'private', atau 'semi_private'
 * @returns {Promise<Object>} Best package for booking
 */
const getBestPackageForBooking = async (memberId, scheduleType) => {
  const result = await checkAvailableSessionsWithFallback(memberId, scheduleType);
  
  if (!result.has_available) {
    throw new Error(`Tidak ada paket yang tersedia untuk booking ${scheduleType} class`);
  }

  return result.best_package;
};

/**
 * Get current active package (highest priority with available sessions)
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Current active package
 */
const getCurrentActivePackage = async (memberId) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    const memberPackages = await MemberPackage.findAll({
      where: { 
        member_id: memberId,
        end_date: {
          [Op.gte]: currentDate
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
      ]
    });

    // Sort by priority and filter packages with available sessions
    const sortedPackages = sortPackagesByPriority(memberPackages);
    
    for (const memberPackage of sortedPackages) {
      const totalAvailable = (memberPackage.remaining_group_session || 0) + 
                           (memberPackage.remaining_private_session || 0) + 
                           (memberPackage.remaining_semi_private_session || 0);
      
      if (totalAvailable > 0) {
        return {
          member_package_id: memberPackage.id,
          package_id: memberPackage.package_id,
          package_name: memberPackage.Package?.name || 'Unknown Package',
          package_type: memberPackage.Package?.type || 'unknown',
          end_date: memberPackage.end_date,
          total_available: totalAvailable,
          group_sessions: {
            total: memberPackage.group_sessions || 0,
            used: memberPackage.used_group_session || 0,
            remaining: memberPackage.remaining_group_session || 0
          },
          private_sessions: {
            total: memberPackage.private_sessions || 0,
            used: memberPackage.used_private_session || 0,
            remaining: memberPackage.remaining_private_session || 0
          },
          semi_private_sessions: {
            total: memberPackage.semi_private_sessions || 0,
            used: memberPackage.used_semi_private_session || 0,
            remaining: memberPackage.remaining_semi_private_session || 0
          }
        };
      }
    }

    return null; // No active package with available sessions

  } catch (error) {
    console.error('Error getting current active package:', error);
    throw error;
  }
};

/**
 * Get total sessions from all packages with priority consideration
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Total sessions (total, used, remaining) from all packages
 */
const getTotalAvailableSessions = async (memberId) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    const memberPackages = await MemberPackage.findAll({
      where: { 
        member_id: memberId,
        end_date: {
          [Op.gte]: currentDate
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
      ]
    });

    // Sort packages by priority
    const sortedPackages = sortPackagesByPriority(memberPackages);
    
    let totalGroupSessions = 0;
    let usedGroupSessions = 0;
    let remainingGroupSessions = 0;
    
    let totalSemiPrivateSessions = 0;
    let usedSemiPrivateSessions = 0;
    let remainingSemiPrivateSessions = 0;
    
    let totalPrivateSessions = 0;
    let usedPrivateSessions = 0;
    let remainingPrivateSessions = 0;
    
    // Calculate total, used, and remaining sessions from all packages
    for (const memberPackage of sortedPackages) {
      // Group sessions
      const groupTotal = memberPackage.group_sessions || 0;
      const groupUsed = memberPackage.used_group_session || 0;
      const groupRemaining = memberPackage.remaining_group_session || 0;
      
      totalGroupSessions += groupTotal;
      usedGroupSessions += groupUsed;
      remainingGroupSessions += groupRemaining;
      
      // Semi-private sessions
      const semiPrivateTotal = memberPackage.semi_private_sessions || 0;
      const semiPrivateUsed = memberPackage.used_semi_private_session || 0;
      const semiPrivateRemaining = memberPackage.remaining_semi_private_session || 0;
      
      totalSemiPrivateSessions += semiPrivateTotal;
      usedSemiPrivateSessions += semiPrivateUsed;
      remainingSemiPrivateSessions += semiPrivateRemaining;
      
      // Private sessions
      const privateTotal = memberPackage.private_sessions || 0;
      const privateUsed = memberPackage.used_private_session || 0;
      const privateRemaining = memberPackage.remaining_private_session || 0;
      
      totalPrivateSessions += privateTotal;
      usedPrivateSessions += privateUsed;
      remainingPrivateSessions += privateRemaining;
    }

    const totalAllSessions = totalGroupSessions + totalSemiPrivateSessions + totalPrivateSessions;
    const usedAllSessions = usedGroupSessions + usedSemiPrivateSessions + usedPrivateSessions;
    const remainingAllSessions = remainingGroupSessions + remainingSemiPrivateSessions + remainingPrivateSessions;

    return {
      total_all_sessions: totalAllSessions,
      used_all_sessions: usedAllSessions,
      remaining_all_sessions: remainingAllSessions,
      total_group_sessions: totalGroupSessions,
      used_group_sessions: usedGroupSessions,
      remaining_group_sessions: remainingGroupSessions,
      total_semi_private_sessions: totalSemiPrivateSessions,
      used_semi_private_sessions: usedSemiPrivateSessions,
      remaining_semi_private_sessions: remainingSemiPrivateSessions,
      total_private_sessions: totalPrivateSessions,
      used_private_sessions: usedPrivateSessions,
      remaining_private_sessions: remainingPrivateSessions
    };

  } catch (error) {
    console.error('Error getting total available sessions:', error);
    throw error;
  }
};

/**
 * Get all member packages sorted by priority for history
 * @param {string} memberId - ID member
 * @returns {Promise<Array>} All member packages sorted by priority
 */
const getAllMemberPackagesByPriority = async (memberId) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    const memberPackages = await MemberPackage.findAll({
      where: { 
        member_id: memberId,
        end_date: {
          [Op.gte]: currentDate
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
        },
        {
          model: Order,
          attributes: ['id', 'order_number', 'paid_at', 'total_amount', 'payment_status']
        }
      ]
    });

    // Sort by priority and return
    return sortPackagesByPriority(memberPackages);

  } catch (error) {
    console.error('Error getting member packages by priority:', error);
    throw error;
  }
};

module.exports = {
  updateSessionUsage,
  updateAllMemberPackagesSessionUsage,
  checkAvailableSessions,
  calculateAvailableSessions,
  validateSessionAvailability,
  getAvailablePackagesForBooking,
  createSessionAllocation,
  getMemberSessionSummary,
  getPackagePriorityScore,
  sortPackagesByPriority,
  checkAvailableSessionsWithFallback,
  getBestPackageForBooking,
  getCurrentActivePackage,
  getTotalAvailableSessions,
  getAllMemberPackagesByPriority
}; 