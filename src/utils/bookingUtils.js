const { Booking, Schedule, Member } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const twilioService = require('../services/twilio.service');

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
            const cancelBufferMinutes = schedule.cancel_buffer_minutes || 120; // Default 2 jam
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

            // Check if current time is within cancel buffer period
            if (currentTime >= cancelDeadline && currentTime < scheduleDateTime) {
                // Count current signups
                const signupCount = await Booking.count({
                    where: {
                        schedule_id: schedule.id,
                        status: 'signup'
                    }
                });

                const minSignup = schedule.min_signup || 1;

                // If signup count is less than minimum, cancel all bookings
                if (signupCount < minSignup) {
                    const bookingsToCancel = await Booking.findAll({
                        where: {
                            schedule_id: schedule.id,
                            status: {
                                [Op.in]: ['signup', 'waiting_list']
                            }
                        },
                        include: [
                            {
                                model: Member
                            }
                        ]
                    });

                    for (const booking of bookingsToCancel) {
                        try {
                            await booking.update({
                                status: 'cancelled',
                                notes: `Auto-cancelled: Kelas dibatalkan karena tidak memenuhi minimum peserta (${signupCount}/${minSignup}) dalam ${cancelBufferMinutes} menit sebelum kelas`
                            });

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

        const maxCapacity = schedule.type === 'semi_private' ? 4 : 20;

        // If we have space, promote from waitlist
        if (currentSignups < maxCapacity) {
            const nextWaitlistBooking = await Booking.findOne({
                where: {
                    schedule_id: scheduleId,
                    status: 'waiting_list'
                },
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
                order: [['createdAt', 'ASC']] // First come, first served
            });

            if (nextWaitlistBooking) {
                await nextWaitlistBooking.update({
                    status: 'signup',
                    notes: 'Promoted from waitlist automatically after cancellation'
                });

                logger.info(`Booking ${nextWaitlistBooking.id} promoted from waitlist to signup for schedule ${scheduleId}`);

                // Send WhatsApp promotion notification (async)
                try {
                    twilioService.sendWaitlistPromotion(nextWaitlistBooking)
                        .then(result => {
                            if (result.success) {
                                logger.info(`✅ WhatsApp promotion notification sent to ${nextWaitlistBooking.Member.full_name}`);
                            } else {
                                logger.error(`❌ Failed to send WhatsApp promotion notification to ${nextWaitlistBooking.Member.full_name}: ${result.error}`);
                            }
                        })
                        .catch(error => {
                            logger.error(`❌ Error sending WhatsApp promotion notification to ${nextWaitlistBooking.Member.full_name}:`, error);
                        });
                } catch (error) {
                    logger.error('Error initiating WhatsApp promotion notification:', error);
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

                const result = await twilioService.sendBookingReminder(booking);
                
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
                    logger.info(`✅ H-1 reminder sent successfully to ${booking.Member.full_name}`);
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
//             include: [
//                 {
//                     model: Schedule,
//                     attributes: ['id', 'date_start', 'time_start', 'type', 'min_signup']
//                 }
//             ],
//             attributes: [
//                 'status',
//                 [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'count']
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