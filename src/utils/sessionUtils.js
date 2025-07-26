const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Booking } = require('../models');

/**
 * Menghitung total sesi yang tersedia untuk member
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Object berisi total sesi dan detail paket
 */
const calculateAvailableSessions = async (memberId) => {
    const memberPackages = await MemberPackage.findAll({
        where: { member_id: memberId },
        include: [
            {
                model: Package,
                include: [
                    { model: PackageMembership },
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
        let sessions = 0;

        // Ambil sesi berdasarkan tipe paket
        switch (package.type) {
            case 'membership':
                if (package.PackageMembership) {
                    sessions = package.PackageMembership.group_session + package.PackageMembership.private_session;
                }
                break;
            case 'first_trial':
                if (package.PackageFirstTrial) {
                    sessions = package.PackageFirstTrial.group_session + package.PackageFirstTrial.private_session;
                }
                break;
            case 'promo':
                if (package.PackagePromo) {
                    sessions = package.PackagePromo.group_session + package.PackagePromo.private_session;
                }
                break;
            case 'bonus':
                if (package.PackageBonus) {
                    sessions = package.PackageBonus.group_session + package.PackageBonus.private_session;
                }
                break;
        }

        // Kurangi dengan sesi yang sudah digunakan
        const usedSessions = await Booking.count({
            where: { 
                member_id: memberId,
                package_id: package.id
            }
        });

        const availableSessions = Math.max(0, sessions - usedSessions);
        totalAvailableSessions += availableSessions;

        if (availableSessions > 0) {
            packageDetails.push({
                package_id: package.id,
                package_type: package.type,
                package_name: package.name,
                available_sessions: availableSessions,
                total_sessions: sessions,
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

    // Urutkan paket berdasarkan prioritas (bisa disesuaikan)
    const sortedPackages = sessionInfo.packageDetails.sort((a, b) => {
        // Prioritas: first_trial > promo > membership > bonus
        const priority = {
            'first_trial': 1,
            'promo': 2,
            'membership': 3,
            'bonus': 4
        };
        return priority[a.package_type] - priority[b.package_type];
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
            package_name: selectedPackage.package_name,
            session_left: selectedPackage.available_sessions - sessionsUsedInCurrentPackage - 1
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

module.exports = {
    calculateAvailableSessions,
    validateSessionAvailability,
    getAvailablePackagesForBooking,
    createSessionAllocation,
    getMemberSessionSummary
}; 