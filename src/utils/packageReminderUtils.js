const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Member } = require('../models');
const { Op } = require('sequelize');
const twilioService = require('../services/twilio.service');
const logger = require('../config/logger');

/**
 * Mengirim reminder untuk paket yang sesinya mau habis
 * @param {number} remainingSessions - Jumlah sesi tersisa untuk trigger reminder
 */
const sendLowSessionReminder = async (remainingSessions = 2) => {
    try {
        logger.info(`📱 Starting low session reminder process (${remainingSessions} sessions remaining)...`);

        const currentDate = new Date();
        
        // Cari member packages yang sesinya mau habis
        const memberPackages = await MemberPackage.findAll({
            where: {
                end_date: {
                    [Op.gte]: currentDate.toISOString().split('T')[0] // Masih berlaku
                }
            },
            include: [
                {
                    model: Package,
                    include: [
                        { model: PackageMembership },
                        { model: PackageFirstTrial },
                        { model: PackagePromo },
                        { model: PackageBonus }
                    ]
                },
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number', 'username']
                }
            ]
        });

        let reminderCount = 0;
        const sentReminders = [];

        for (const memberPackage of memberPackages) {
            try {
                // Hitung total sesi tersisa
                const totalRemainingSessions = (memberPackage.remaining_group_session || 0) + (memberPackage.remaining_private_session || 0);
                
                // Cek apakah sesi tersisa <= threshold
                if (totalRemainingSessions <= remainingSessions && totalRemainingSessions > 0) {
                    const package = memberPackage.Package;
                    let packageName = 'Unknown Package';
                    let packageDetails = '';

                    // Tentukan nama dan detail paket
                    if (package.PackageMembership) {
                        packageName = package.PackageMembership.Category?.category_name || 'Membership Package';
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

                    // Kirim reminder via WhatsApp
                    const reminderData = {
                        member_name: memberPackage.Member.full_name,
                        phone_number: memberPackage.Member.phone_number,
                        package_name: packageName,
                        package_details: packageDetails,
                        remaining_sessions: totalRemainingSessions,
                        end_date: memberPackage.end_date,
                        days_remaining: Math.ceil((new Date(memberPackage.end_date) - currentDate) / (1000 * 60 * 60 * 24))
                    };

                    const result = await twilioService.sendLowSessionReminder(reminderData);
                    
                    if (result.success) {
                        reminderCount++;
                        sentReminders.push({
                            member_name: memberPackage.Member.full_name,
                            phone_number: memberPackage.Member.phone_number,
                            package_name: packageName,
                            remaining_sessions: totalRemainingSessions,
                            sent_at: new Date()
                        });
                        
                        logger.info(`✅ Low session reminder sent to ${memberPackage.Member.full_name} (${totalRemainingSessions} sessions remaining)`);
                    } else {
                        logger.error(`❌ Failed to send low session reminder to ${memberPackage.Member.full_name}: ${result.error}`);
                    }
                }
            } catch (error) {
                logger.error(`❌ Error processing low session reminder for member ${memberPackage.Member.full_name}:`, error);
            }
        }

        logger.info(`📱 Low session reminder process completed. Sent: ${reminderCount} reminders`);
        return {
            success: true,
            total_sent: reminderCount,
            reminders: sentReminders
        };

    } catch (error) {
        logger.error('❌ Error in sendLowSessionReminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Mengirim reminder untuk paket yang mendekati masa berakhir
 * @param {number} daysBeforeExpiry - Jumlah hari sebelum expiry untuk trigger reminder
 */
const sendExpiryReminder = async (daysBeforeExpiry = 7) => {
    try {
        logger.info(`📱 Starting expiry reminder process (${daysBeforeExpiry} days before expiry)...`);

        const currentDate = new Date();
        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + daysBeforeExpiry);
        
        // Cari member packages yang akan berakhir dalam X hari
        const memberPackages = await MemberPackage.findAll({
            where: {
                end_date: {
                    [Op.between]: [
                        currentDate.toISOString().split('T')[0],
                        expiryThreshold.toISOString().split('T')[0]
                    ]
                }
            },
            include: [
                {
                    model: Package,
                    include: [
                        { model: PackageMembership },
                        { model: PackageFirstTrial },
                        { model: PackagePromo },
                        { model: PackageBonus }
                    ]
                },
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number', 'username']
                }
            ]
        });

        let reminderCount = 0;
        const sentReminders = [];

        for (const memberPackage of memberPackages) {
            try {
                const package = memberPackage.Package;
                let packageName = 'Unknown Package';
                let packageDetails = '';

                // Tentukan nama dan detail paket
                if (package.PackageMembership) {
                    packageName = package.PackageMembership.Category?.category_name || 'Membership Package';
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

                const daysRemaining = Math.ceil((new Date(memberPackage.end_date) - currentDate) / (1000 * 60 * 60 * 24));
                const totalRemainingSessions = (memberPackage.remaining_group_session || 0) + (memberPackage.remaining_private_session || 0);

                // Kirim reminder via WhatsApp
                const reminderData = {
                    member_name: memberPackage.Member.full_name,
                    phone_number: memberPackage.Member.phone_number,
                    package_name: packageName,
                    package_details: packageDetails,
                    remaining_sessions: totalRemainingSessions,
                    end_date: memberPackage.end_date,
                    days_remaining: daysRemaining
                };

                const result = await twilioService.sendExpiryReminder(reminderData);
                
                if (result.success) {
                    reminderCount++;
                    sentReminders.push({
                        member_name: memberPackage.Member.full_name,
                        phone_number: memberPackage.Member.phone_number,
                        package_name: packageName,
                        days_remaining: daysRemaining,
                        remaining_sessions: totalRemainingSessions,
                        sent_at: new Date()
                    });
                    
                    logger.info(`✅ Expiry reminder sent to ${memberPackage.Member.full_name} (${daysRemaining} days remaining)`);
                } else {
                    logger.error(`❌ Failed to send expiry reminder to ${memberPackage.Member.full_name}: ${result.error}`);
                }
            } catch (error) {
                logger.error(`❌ Error processing expiry reminder for member ${memberPackage.Member.full_name}:`, error);
            }
        }

        logger.info(`📱 Expiry reminder process completed. Sent: ${reminderCount} reminders`);
        return {
            success: true,
            total_sent: reminderCount,
            reminders: sentReminders
        };

    } catch (error) {
        logger.error('❌ Error in sendExpiryReminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Mengirim semua reminder paket (low session + expiry)
 */
const sendAllPackageReminders = async () => {
    try {
        logger.info('📱 Starting all package reminders process...');

        const lowSessionResult = await sendLowSessionReminder(2); // Reminder jika <= 2 sesi tersisa
        const expiryResult = await sendExpiryReminder(7); // Reminder 7 hari sebelum expiry

        return {
            success: true,
            low_session: lowSessionResult,
            expiry: expiryResult,
            total_sent: (lowSessionResult.total_sent || 0) + (expiryResult.total_sent || 0)
        };

    } catch (error) {
        logger.error('❌ Error in sendAllPackageReminders:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendLowSessionReminder,
    sendExpiryReminder,
    sendAllPackageReminders
}; 