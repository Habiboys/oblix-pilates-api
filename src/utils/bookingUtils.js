const { Booking, Schedule, Member } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const twilioService = require('../services/twilio.service');

/**
 * Auto-cancel bookings that exceed cancel buffer time
 * This function should be called by a cron job or scheduler
 */
const autoCancelExpiredBookings = async () => {
    try {
        logger.info('Starting auto-cancel expired bookings process...');

        const currentTime = new Date();
        
        // Get all active bookings (signup or waiting_list) that need to be cancelled
        const bookingsToCancel = await Booking.findAll({
            where: {
                status: {
                    [Op.in]: ['signup', 'waiting_list']
                }
            },
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: {
                            [Op.gte]: currentTime.toISOString().split('T')[0] // Today or future
                        }
                    }
                },
                {
                    model: Member
                }
            ]
        });

        let cancelledCount = 0;
        const cancelledBookings = [];

        for (const booking of bookingsToCancel) {
            const scheduleDateTime = new Date(`${booking.Schedule.date_start}T${booking.Schedule.time_start}`);
            const cancelBufferMinutes = booking.Schedule.cancel_buffer_minutes || 120; // Default 2 jam
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

            // If current time is past cancel deadline, cancel the booking
            if (currentTime > cancelDeadline) {
                try {
                    await booking.update({
                        status: 'cancelled',
                        notes: `Auto-cancelled: Melebihi batas waktu cancel (${cancelBufferMinutes} menit sebelum kelas)`
                    });

                    cancelledCount++;
                    cancelledBookings.push({
                        booking_id: booking.id,
                        member_name: booking.Member.full_name,
                        schedule_date: booking.Schedule.date_start,
                        schedule_time: booking.Schedule.time_start,
                        cancel_reason: 'Auto-cancelled due to cancel buffer time'
                    });

                    logger.info(`Auto-cancelled booking ${booking.id} for member ${booking.Member.full_name}`);
                } catch (error) {
                    logger.error(`Error auto-cancelling booking ${booking.id}:`, error);
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
                        model: Member
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
 * Check and cancel bookings for schedules that don't meet minimum signup
 */
const cancelInsufficientBookings = async () => {
    try {
        logger.info('Starting insufficient bookings cancellation process...');

        const currentTime = new Date();
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get schedules for tomorrow that don't meet minimum signup
        const schedules = await Schedule.findAll({
            where: {
                date_start: tomorrow.toISOString().split('T')[0],
                type: {
                    [Op.in]: ['group', 'semi_private']
                }
            }
        });

        let cancelledCount = 0;

        for (const schedule of schedules) {
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
                    await booking.update({
                        status: 'cancelled',
                        notes: `Auto-cancelled: Kelas dibatalkan karena tidak memenuhi minimum peserta (${signupCount}/${minSignup})`
                    });

                    cancelledCount++;
                    logger.info(`Auto-cancelled booking ${booking.id} due to insufficient signups for schedule ${schedule.id}`);
                }
            }
        }

        logger.info(`Insufficient bookings cancellation completed. Cancelled ${cancelledCount} bookings.`);
        
        return {
            success: true,
            cancelled_count: cancelledCount
        };

    } catch (error) {
        logger.error('Error in insufficient bookings cancellation:', error);
        return {
            success: false,
            error: error.message
        };
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
 */
const getBookingStatistics = async () => {
    try {
        const currentTime = new Date();
        const today = currentTime.toISOString().split('T')[0];

        const stats = await Booking.findAll({
            where: {
                '$Schedule.date_start$': {
                    [Op.gte]: today
                }
            },
            include: [
                {
                    model: Schedule,
                    attributes: ['id', 'date_start', 'time_start', 'type', 'min_signup']
                }
            ],
            attributes: [
                'status',
                [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'count']
            ],
            group: ['Booking.status', 'Schedule.id', 'Schedule.date_start', 'Schedule.time_start', 'Schedule.type', 'Schedule.min_signup']
        });

        return {
            success: true,
            statistics: stats
        };

    } catch (error) {
        logger.error('Error getting booking statistics:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    autoCancelExpiredBookings,
    processWaitlistPromotion,
    cancelInsufficientBookings,
    getBookingStatistics,
    sendH1Reminders
}; 