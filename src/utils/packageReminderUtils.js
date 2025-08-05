const { MemberPackage, Package, PackageMembership, PackageFirstTrial, PackagePromo, PackageBonus, Member, User } = require('../models');
const { Op } = require('sequelize');
const twilioService = require('../services/twilio.service');
const logger = require('../config/logger');

/**
 * Mengirim reminder untuk paket yang sesinya mau habis
 * Menggunakan field reminder_session dari tabel packages
 */
const sendLowSessionReminder = async () => {
    try {
        logger.info(`📱 Starting low session reminder process...`);

        const currentDate = new Date();
        
        // Cari member packages yang sesinya mau habis berdasarkan reminder_session dari package
        const memberPackages = await MemberPackage.findAll({
            where: {
                end_date: {
                    [Op.gte]: currentDate.toISOString().split('T')[0] // Masih berlaku
                }
            },
            include: [
                {
                    model: Package,
                    where: {
                        reminder_session: {
                            [Op.not]: null // Hanya paket yang memiliki reminder_session
                        }
                    },
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
                // Get member's email
                const user = await User.findByPk(memberPackage.Member.user_id);
                const memberEmail = user?.email;
                
                // Hitung total sesi tersisa
                const totalRemainingSessions = (memberPackage.remaining_group_session || 0) + (memberPackage.remaining_private_session || 0);
                
                // Gunakan reminder_session dari package sebagai threshold
                const reminderThreshold = memberPackage.Package.reminder_session || 2;
                
                // Cek apakah sesi tersisa <= threshold
                if (totalRemainingSessions <= reminderThreshold && totalRemainingSessions > 0) {
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

                    // Kirim reminder via WhatsApp dan Email
                    const reminderData = {
                        member_name: memberPackage.Member.full_name,
                        phone_number: memberPackage.Member.phone_number,
                        email: memberEmail,
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
                            reminder_threshold: reminderThreshold,
                            sent_at: new Date(),
                            whatsapp: result.whatsapp?.success || false,
                            email: result.email?.success || false
                        });
                        
                        logger.info(`✅ Low session reminder sent to ${memberPackage.Member.full_name} (${totalRemainingSessions}/${reminderThreshold} sessions remaining) - WhatsApp: ${result.whatsapp?.success || false}, Email: ${result.email?.success || false}`);
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
 * Menggunakan field reminder_day dari tabel packages
 */
const sendExpiryReminder = async () => {
    try {
        logger.info(`📱 Starting expiry reminder process...`);

        const currentDate = new Date();
        
        // Cari member packages yang akan berakhir berdasarkan reminder_day dari package
        const memberPackages = await MemberPackage.findAll({
            where: {
                end_date: {
                    [Op.gte]: currentDate.toISOString().split('T')[0] // Masih berlaku
                }
            },
            include: [
                {
                    model: Package,
                    where: {
                        reminder_day: {
                            [Op.not]: null // Hanya paket yang memiliki reminder_day
                        }
                    },
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
                // Get member's email
                const user = await User.findByPk(memberPackage.Member.user_id);
                const memberEmail = user?.email;
                
                const package = memberPackage.Package;
                const reminderDays = package.reminder_day || 7;
                
                // Hitung hari tersisa sampai expiry
                const daysRemaining = Math.ceil((new Date(memberPackage.end_date) - currentDate) / (1000 * 60 * 60 * 24));
                
                // Cek apakah hari tersisa <= reminder_day
                if (daysRemaining <= reminderDays && daysRemaining > 0) {
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

                const totalRemainingSessions = (memberPackage.remaining_group_session || 0) + (memberPackage.remaining_private_session || 0);

                    // Kirim reminder via WhatsApp dan Email
                const reminderData = {
                    member_name: memberPackage.Member.full_name,
                    phone_number: memberPackage.Member.phone_number,
                        email: memberEmail,
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
                            reminder_days: reminderDays,
                        remaining_sessions: totalRemainingSessions,
                            sent_at: new Date(),
                            whatsapp: result.whatsapp?.success || false,
                            email: result.email?.success || false
                    });
                    
                        logger.info(`✅ Expiry reminder sent to ${memberPackage.Member.full_name} (${daysRemaining}/${reminderDays} days remaining) - WhatsApp: ${result.whatsapp?.success || false}, Email: ${result.email?.success || false}`);
                } else {
                    logger.error(`❌ Failed to send expiry reminder to ${memberPackage.Member.full_name}: ${result.error}`);
                    }
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

        const lowSessionResult = await sendLowSessionReminder(); // Reminder jika <= 2 sesi tersisa
        const expiryResult = await sendExpiryReminder(); // Reminder 7 hari sebelum expiry

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