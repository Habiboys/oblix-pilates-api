const { Booking, Schedule, Member, MemberPackage } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const whatsappService = require('../services/whatsapp.service');
const { updateSessionUsage, setPackageStartDate } = require('./sessionTrackingUtils');

/**
 * Auto-cancel bookings when minimum signup is not met within cancel buffer time
 * This function should be called by a cron job or scheduler
 */
const autoCancelExpiredBookings = async () => {
    try {
        logger.info('Starting auto-cancel expired bookings process...');

        const currentTime = new Date();
        
        // Get all active schedules that are within cancel buffer time
        const schedules = await Schedule.findAll({
            // Add timeout to prevent hanging connections
            timeout: 30000, // 30 seconds timeout
            where: {
                date_start: {
                    [Op.gte]: currentTime.toISOString().split('T')[0] // Today or future
                },
                type: {
                    [Op.in]: ['group', 'semi_private']
                }
            }
        });

        let cancelledCount = 0;
        const cancelledBookings = [];

        for (const schedule of schedules) {
            const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
            const cancelBufferMinutes = schedule.cancel_buffer_minutes ?? 120; // Default 2 jam jika null/undefined
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

            // Check if current time is within cancel buffer period
            if (currentTime >= cancelDeadline && currentTime < scheduleDateTime) {
                // Count current signups
                const signupCount = await Booking.count({
                    timeout: 10000, // 10 seconds timeout
                    where: {
                        schedule_id: schedule.id,
                        status: 'signup'
                    }
                });

                const minSignup = schedule.min_signup || 1;

                // If signup count is less than minimum, cancel all bookings
                if (signupCount < minSignup) {
                    const bookingsToCancel = await Booking.findAll({
                        timeout: 15000, // 15 seconds timeout
                        where: {
                            schedule_id: schedule.id,
                            status: {
                                [Op.in]: ['signup', 'waiting_list']
                            }
                        },
                        attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
                        include: [
                            {
                                model: Member,
                                include: [
                                    {
                                        model: require('../models').User,
                                        attributes: ['id', 'email']
                                    }
                                ]
                            }
                        ]
                    });

                    // Cancel all bookings
                    for (const booking of bookingsToCancel) {
                        try {
                            await booking.update({
                                status: 'cancelled',
                                notes: `Auto-cancelled: Kelas dibatalkan karena tidak memenuhi minimum peserta (${signupCount}/${minSignup}) dalam ${cancelBufferMinutes} menit sebelum kelas`,
                                cancelled_by: 'system' // System auto-cancel
                            });

                            // PERBAIKAN: Update session usage setelah auto cancel untuk mengembalikan quota
                            try {
                                // Refresh booking data untuk memastikan status terbaru
                                await booking.reload();
                                
                                // Extract member_package_id dari notes
                                let memberPackageId = null;
                                if (booking.notes && booking.notes.includes('MemberPackageID:')) {
                                    const match = booking.notes.match(/MemberPackageID: ([a-f0-9-]+)/);
                                    if (match) {
                                        memberPackageId = match[1];
                                    }
                                }
                                
                                // Gunakan member_package_id dari notes jika ada, jika tidak gunakan package_id
                                let targetMemberPackage = null;
                                if (memberPackageId) {
                                    targetMemberPackage = await MemberPackage.findOne({
                                        where: {
                                            id: memberPackageId
                                        }
                                    });
                                }
                                
                                // Fallback: cari berdasarkan package_id jika member_package_id tidak ditemukan
                                if (!targetMemberPackage) {
                                    targetMemberPackage = await MemberPackage.findOne({
                                        where: {
                                            member_id: booking.member_id,
                                            package_id: booking.package_id
                                        }
                                    });
                                }
                                
                                if (targetMemberPackage) {
                                    await updateSessionUsage(targetMemberPackage.id, booking.member_id, targetMemberPackage.package_id);
                                    logger.info(`✅ Session returned for member ${booking.Member.full_name} after auto-cancel`);
                                }
                            } catch (error) {
                                logger.error(`❌ Failed to update session usage after auto-cancel for booking ${booking.id}: ${error.message}`);
                            }

                            cancelledCount++;
                            cancelledBookings.push({
                                booking_id: booking.id,
                                member_name: booking.Member.full_name,
                                schedule_date: schedule.date_start,
                                schedule_time: schedule.time_start,
                                schedule_id: schedule.id,
                                cancel_reason: `Auto-cancelled due to insufficient signups (${signupCount}/${minSignup})`
                            });

                            logger.info(`Auto-cancelled booking ${booking.id} for member ${booking.Member.full_name} - insufficient signups (${signupCount}/${minSignup})`);
                        } catch (error) {
                            logger.error(`Error auto-cancelling booking ${booking.id}:`, error);
                        }
                    }

                    // Send class cancellation notification to all cancelled members
                    try {
                        // Get schedule with Class info for notifications
                        const scheduleWithClass = await Schedule.findByPk(schedule.id, {
                            include: [
                                {
                                    model: require('../models').Class,
                                    attributes: ['id', 'class_name']
                                }
                            ]
                        });
                        
                        logger.info(`📧 Preparing to send notifications for ${bookingsToCancel.length} cancelled bookings`);
                        logger.info(`📧 Schedule: ${scheduleWithClass.Class?.class_name || 'Unknown'} on ${schedule.date_start} ${schedule.time_start}`);
                        
                        const result = await whatsappService.sendClassCancellation(bookingsToCancel, scheduleWithClass);
                        const successCount = result.filter(r => r.success).length;
                        const whatsappCount = result.filter(r => r.whatsapp && r.whatsapp.success).length;
                        const emailCount = result.filter(r => r.email && r.email.success).length;
                        
                        logger.info(`📱 Class cancellation notifications sent: ${successCount}/${result.length} members notified successfully`);
                        logger.info(`📱 WhatsApp: ${whatsappCount}/${result.length}, 📧 Email: ${emailCount}/${result.length}`);
                        
                        // Log detailed results for debugging
                        result.forEach((r, index) => {
                            logger.info(`📧 Member ${index + 1}: ${r.member_name} - WhatsApp: ${r.whatsapp?.success ? '✅' : '❌'}, Email: ${r.email?.success ? '✅' : '❌'}`);
                            if (r.email && !r.email.success) {
                                logger.error(`📧 Email failed for ${r.member_name}: ${r.email.error}`);
                            }
                        });
                    } catch (error) {
                        logger.error('❌ Error sending class cancellation notifications:', error);
                    }
                }
            }
        }

        // Process waitlist promotion for schedules that had cancellations
        const scheduleIds = [...new Set(cancelledBookings.map(b => b.schedule_id))];
        for (const scheduleId of scheduleIds) {
            await processWaitlistPromotion(scheduleId);
        }

        logger.info(`Auto-cancel process completed. Cancelled ${cancelledCount} bookings.`);
        
        return {
            success: true,
            cancelled_count: cancelledCount,
            cancelled_bookings: cancelledBookings
        };

    } catch (error) {
        logger.error('Error in auto-cancel process:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Process waitlist promotion for a specific schedule
 */
const processWaitlistPromotion = async (scheduleId) => {
    try {
        const schedule = await Schedule.findByPk(scheduleId);
        if (!schedule) return null;

        // Count current signup bookings
        const currentSignups = await Booking.count({
            where: {
                schedule_id: scheduleId,
                status: 'signup'
            }
        });

        const maxCapacity = schedule.pax || 20;
        
        logger.info(`🔄 ProcessWaitlistPromotion: scheduleId=${scheduleId}, currentSignups=${currentSignups}, maxCapacity=${maxCapacity}`);

        // If we have space, promote from waitlist
        if (currentSignups < maxCapacity) {
            logger.info(`🔄 Checking for waitlist promotion: currentSignups=${currentSignups}, maxCapacity=${maxCapacity}`);
            
            // PERBAIKAN: Ambil SEMUA booking untuk schedule ini untuk mendapatkan urutan waitlist yang akurat
            const allScheduleBookings = await Booking.findAll({
                where: { schedule_id: scheduleId },
                include: [
                    {
                        model: Member,
                        attributes: ['id', 'full_name', 'phone_number']
                    },
                    {
                        model: Schedule,
                        include: [
                            {
                                model: require('../models').Class,
                                attributes: ['id', 'class_name']
                            }
                        ]
                    }
                ],
                order: [['createdAt', 'ASC'], ['id', 'ASC']]
            });
            
            // Filter booking yang pernah masuk waitlist (termasuk yang sekarang cancelled)
            const waitlistHistory = allScheduleBookings.filter(b => 
                b.status === 'waiting_list' || 
                (b.status === 'cancelled' && b.notes && b.notes.includes('waitlist'))
            );
            
            // Sort berdasarkan waitlist_joined_at untuk mendapatkan urutan waitlist yang fair
            const sortedWaitlistHistory = waitlistHistory.sort((a, b) => {
                // Gunakan waitlist_joined_at jika ada, fallback ke createdAt
                const aTime = a.waitlist_joined_at ? a.waitlist_joined_at.getTime() : a.createdAt.getTime();
                const bTime = b.waitlist_joined_at ? b.waitlist_joined_at.getTime() : b.createdAt.getTime();
                
                if (aTime !== bTime) {
                    return aTime - bTime;
                }
                return a.id.localeCompare(b.id);
            });
            
            // Ambil booking pertama yang masih di waitlist
            const nextWaitlistBooking = sortedWaitlistHistory.find(b => b.status === 'waiting_list');
            
            logger.info(`📊 Waitlist history for promotion: ${sortedWaitlistHistory.length} bookings`);
            sortedWaitlistHistory.forEach((booking, index) => {
                logger.info(`   ${index + 1}. ${booking.Member.full_name} - Status: ${booking.status} - Created: ${booking.createdAt}`);
            });

            logger.info(`🔍 Looking for waitlist booking: found ${nextWaitlistBooking ? 'YES' : 'NO'}`);
            if (nextWaitlistBooking) {
                logger.info(`🔍 Found waitlist booking: ${nextWaitlistBooking.Member.full_name} (ID: ${nextWaitlistBooking.id})`);
            }

            if (nextWaitlistBooking) {
                await nextWaitlistBooking.update({
                    status: 'signup',
                    notes: 'Promoted from waitlist automatically after cancellation'
                });

                logger.info(`Booking ${nextWaitlistBooking.id} promoted from waitlist to signup for schedule ${scheduleId}`);

                // Update session usage untuk member yang dipromosikan
                try {
                    const memberPackage = await require('../models').MemberPackage.findOne({
                        where: {
                            member_id: nextWaitlistBooking.member_id,
                            package_id: nextWaitlistBooking.package_id
                        }
                    });
                    
                    if (memberPackage) {
                        await updateSessionUsage(memberPackage.id, nextWaitlistBooking.member_id, nextWaitlistBooking.package_id);
                        logger.info(`✅ Session usage updated for promoted member ${nextWaitlistBooking.Member.full_name}`);
                        
                        // PERBAIKAN: Set start_date dan end_date saat booking dipromosikan dari waitlist ke signup
                        try {
                            logger.info(`📅 Setting start_date for promoted booking: member_id=${nextWaitlistBooking.member_id}, package_id=${nextWaitlistBooking.package_id}`);
                            const dateResult = await setPackageStartDate(nextWaitlistBooking.member_id, nextWaitlistBooking.package_id, memberPackage.id);
                            logger.info(`✅ Start date set successfully for promoted member:`, dateResult);
                        } catch (dateError) {
                            logger.error(`❌ Failed to set start_date for promoted member: ${dateError.message}`);
                        }
                    } else {
                        logger.error(`❌ Member package not found for promoted member ${nextWaitlistBooking.Member.full_name}`);
                    }
                } catch (error) {
                    logger.error(`❌ Failed to update session usage for promoted member ${nextWaitlistBooking.Member.full_name}: ${error.message}`);
                }

                // Send WhatsApp promotion notification (async)
                try {
                    whatsappService.sendWaitlistPromotion(nextWaitlistBooking)
                        .then(result => {
                            if (result.success) {
                                logger.info(`✅ WhatsApp & Email promotion notification sent to ${nextWaitlistBooking.Member.full_name}`);
                                logger.info(`📱 WhatsApp: ${result.whatsapp.success ? '✅' : '❌'}, 📧 Email: ${result.email.success ? '✅' : '❌'}`);
                            } else {
                                logger.error(`❌ Failed to send promotion notification to ${nextWaitlistBooking.Member.full_name}: ${result.error}`);
                            }
                        })
                        .catch(error => {
                            logger.error(`❌ Error sending promotion notification to ${nextWaitlistBooking.Member.full_name}:`, error);
                        });
                } catch (error) {
                    logger.error('Error initiating promotion notification:', error);
                }

                return nextWaitlistBooking;
            }
        }

        return null;
    } catch (error) {
        logger.error('Error processing waitlist promotion:', error);
        return null;
    }
};



/**
 * Send H-1 reminder to members with bookings tomorrow
 */
const sendH1Reminders = async () => {
    try {
        logger.info('📱 Starting H-1 reminder process...');

        const currentTime = new Date();
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];

        // Get all active bookings for tomorrow
        const bookings = await Booking.findAll({
            where: {
                status: {
                    [Op.in]: ['signup', 'waiting_list']
                }
            },
            attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: tomorrowDate
                    },
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['id', 'title', 'picture']
                        }
                    ]
                },
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number']
                }
            ]
        });

        let successCount = 0;
        let failedCount = 0;
        const results = [];

        for (const booking of bookings) {
            try {
                logger.info(`📱 Sending H-1 reminder to ${booking.Member.full_name} for class ${booking.Schedule.Class.class_name}`);

                const result = await whatsappService.sendBookingReminder(booking);
                
                results.push({
                    booking_id: booking.id,
                    member_name: booking.Member.full_name,
                    class_name: booking.Schedule.Class.class_name,
                    schedule_date: booking.Schedule.date_start,
                    schedule_time: booking.Schedule.time_start,
                    ...result
                });

                if (result.success) {
                    successCount++;
                    logger.info(`✅ H-1 reminder sent successfully to ${booking.Member.full_name} - WhatsApp: ${result.whatsapp?.success || false}, Email: ${result.email?.success || false}`);
                } else {
                    failedCount++;
                    logger.error(`❌ Failed to send H-1 reminder to ${booking.Member.full_name}: ${result.error}`);
                }

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                failedCount++;
                logger.error(`❌ Error sending H-1 reminder to ${booking.Member.full_name}:`, error);
                results.push({
                    booking_id: booking.id,
                    member_name: booking.Member.full_name,
                    error: error.message
                });
            }
        }

        logger.info(`📱 H-1 reminder process completed. Success: ${successCount}, Failed: ${failedCount}`);

        return {
            success: true,
            total_bookings: bookings.length,
            success_count: successCount,
            failed_count: failedCount,
            results: results
        };

    } catch (error) {
        logger.error('❌ Error in H-1 reminder process:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get booking statistics for monitoring
//  */
// const getBookingStatistics = async () => {
//     try {
//         const currentTime = new Date();
//         const today = currentTime.toISOString().split('T')[0];

//         const stats = await Booking.findAll({
//             where: {
//                 '$Schedule.date_start$': {
//                     [Op.gte]: today
//                 }
//             },
//             attributes: [
//                 'id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt',
//                 [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'count']
//             ],
//             include: [
//                 {
//                     model: Schedule,
//                     attributes: ['id', 'date_start', 'time_start', 'type', 'min_signup']
//                 }
//             ],
//             group: ['Booking.status', 'Schedule.id', 'Schedule.date_start', 'Schedule.time_start', 'Schedule.type', 'Schedule.min_signup']
//         });

//         return {
//             success: true,
//             statistics: stats
//         };

//     } catch (error) {
//         logger.error('Error getting booking statistics:', error);
//         return {
//             success: false,
//             error: error.message
//         };
//     }
// };

module.exports = {
    autoCancelExpiredBookings,
    processWaitlistPromotion,
    // getBookingStatistics,
    sendH1Reminders
}; 