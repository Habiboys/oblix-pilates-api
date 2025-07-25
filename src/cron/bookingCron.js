const cron = require('node-cron');
const { autoCancelExpiredBookings, cancelInsufficientBookings, sendH1Reminders } = require('../utils/bookingUtils');
const logger = require('../config/logger');

/**
 * Cron job untuk auto-cancel booking yang melebihi cancel buffer time
 * Berjalan setiap 15 menit
 */
const startAutoCancelCron = () => {
    // Schedule: setiap 15 menit
    cron.schedule('*/15 * * * *', async () => {
        logger.info('🕐 Running auto-cancel cron job...');
        
        try {
            const result = await autoCancelExpiredBookings();
            
            if (result.success && result.cancelled_count > 0) {
                logger.info(`✅ Auto-cancel completed: ${result.cancelled_count} bookings cancelled`);
                
                // Log details of cancelled bookings
                result.cancelled_bookings.forEach(booking => {
                    logger.info(`📋 Cancelled booking ${booking.booking_id} for ${booking.member_name} - ${booking.schedule_date} ${booking.schedule_time}`);
                });
            } else {
                logger.info('✅ Auto-cancel completed: No bookings to cancel');
            }
        } catch (error) {
            logger.error('❌ Error in auto-cancel cron job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('🕐 Auto-cancel cron job scheduled (every 15 minutes)');
};

/**
 * Cron job untuk cancel booking yang tidak memenuhi minimum signup
 * Berjalan setiap hari jam 18:00 (6 PM)
 */
const startInsufficientCancelCron = () => {
    // Schedule: setiap hari jam 18:00
    cron.schedule('0 18 * * *', async () => {
        logger.info('🕐 Running insufficient bookings cancellation cron job...');
        
        try {
            const result = await cancelInsufficientBookings();
            
            if (result.success && result.cancelled_count > 0) {
                logger.info(`✅ Insufficient bookings cancellation completed: ${result.cancelled_count} bookings cancelled`);
            } else {
                logger.info('✅ Insufficient bookings cancellation completed: No bookings to cancel');
            }
        } catch (error) {
            logger.error('❌ Error in insufficient bookings cancellation cron job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('🕐 Insufficient bookings cancellation cron job scheduled (daily at 18:00)');
};

/**
 * Cron job untuk reminder booking H-1
 * Berjalan setiap hari jam 18:00 (6 PM) untuk mengirim reminder kelas besok
 */
const startBookingReminderCron = () => {
    // Schedule: setiap hari jam 18:00
    cron.schedule('0 18 * * *', async () => {
        logger.info('📱 Running H-1 booking reminder cron job...');
        
        try {
            const result = await sendH1Reminders();
            
            if (result.success) {
                logger.info(`📱 H-1 reminder completed: ${result.success_count} sent, ${result.failed_count} failed`);
                
                // Log details of sent reminders
                result.results.forEach(reminder => {
                    if (reminder.success) {
                        logger.info(`📱 H-1 reminder sent to ${reminder.member_name} for ${reminder.class_name}`);
                    } else {
                        logger.error(`❌ Failed to send H-1 reminder to ${reminder.member_name}: ${reminder.error}`);
                    }
                });
            } else {
                logger.error('❌ H-1 reminder process failed:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error in H-1 reminder cron job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('📱 H-1 booking reminder cron job scheduled (daily at 18:00)');
};

/**
 * Start all cron jobs
 */
const startAllCronJobs = () => {
    logger.info('🚀 Starting all booking cron jobs...');
    
    startAutoCancelCron();
    startInsufficientCancelCron();
    startBookingReminderCron();
    
    logger.info('✅ All booking cron jobs started successfully');
};

/**
 * Stop all cron jobs
 */
const stopAllCronJobs = () => {
    logger.info('🛑 Stopping all booking cron jobs...');
    
    // Get all scheduled tasks
    const tasks = cron.getTasks();
    
    // Stop all tasks
    Object.keys(tasks).forEach(taskName => {
        if (taskName.includes('booking') || taskName.includes('cancel')) {
            tasks[taskName].stop();
            logger.info(`🛑 Stopped cron job: ${taskName}`);
        }
    });
    
    logger.info('✅ All booking cron jobs stopped successfully');
};

module.exports = {
    startAutoCancelCron,
    startInsufficientCancelCron,
    startBookingReminderCron,
    startAllCronJobs,
    stopAllCronJobs
}; 