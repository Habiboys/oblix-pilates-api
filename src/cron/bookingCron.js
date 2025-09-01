const cron = require('node-cron');
const { autoCancelExpiredBookings, sendH1Reminders } = require('../utils/bookingUtils');
const { Schedule } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Store scheduled tasks for dynamic management
const scheduledCancelTasks = new Map();

/**
 * Dynamic scheduling untuk auto-cancel berdasarkan buffer time dari masing-masing schedule
 * Menjadwalkan cancel job tepat pada waktu cancel deadline dari setiap schedule
 */
const scheduleDynamicCancelJobs = async () => {
    try {
        logger.info('🕐 Setting up dynamic cancel scheduling...');
        
        const currentTime = new Date();
        
        // Get all future schedules that need cancel scheduling
        const schedules = await Schedule.findAll({
            attributes: [
                'id', 'class_id', 'picture', 'trainer_id', 'pax', 'type', 
                'date_start', 'time_start', 'time_end', 'repeat_type', 
                'repeat_days', 'schedule_until', 'booking_deadline_hour', 
                'min_signup', 'cancel_buffer_minutes', 'parent_schedule_id', 
                'member_id', 'level', 'createdAt', 'updatedAt'
            ],
            where: {
                date_start: {
                    [Op.gte]: currentTime.toISOString().split('T')[0] // Today or future
                },
                type: {
                    [Op.in]: ['group', 'semi_private']
                }
            },
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Clear existing scheduled tasks
        scheduledCancelTasks.forEach((task, scheduleId) => {
            task.stop();
            scheduledCancelTasks.delete(scheduleId);
        });

        let scheduledCount = 0;

        for (const schedule of schedules) {
            const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
            const cancelBufferMinutes = schedule.cancel_buffer_minutes ?? 120;
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

            // Only schedule if cancel deadline is in the future
            if (cancelDeadline > currentTime) {
                const scheduleId = schedule.id;
                
                // Create cron expression for the exact cancel deadline time
                const cancelDate = new Date(cancelDeadline);
                const cronExpression = `${cancelDate.getMinutes()} ${cancelDate.getHours()} ${cancelDate.getDate()} ${cancelDate.getMonth() + 1} *`;
                
                // Schedule the cancel job
                const task = cron.schedule(cronExpression, async () => {
                    logger.info(`🕐 Running auto-cancel for schedule ${scheduleId} (${schedule.date_start} ${schedule.time_start})`);
                    
                    try {
                        const result = await autoCancelExpiredBookings();
                        
                        if (result.success && result.cancelled_count > 0) {
                            logger.info(`✅ Auto-cancel completed for schedule ${scheduleId}: ${result.cancelled_count} bookings cancelled`);
                            
                            // Log details of cancelled bookings
                            result.cancelled_bookings.forEach(booking => {
                                logger.info(`📋 Cancelled booking ${booking.booking_id} for ${booking.member_name} - ${booking.schedule_date} ${booking.schedule_time}`);
                            });
                        } else {
                            logger.info(`✅ Auto-cancel completed for schedule ${scheduleId}: No bookings to cancel`);
                        }
                    } catch (error) {
                        logger.error(`❌ Error in auto-cancel for schedule ${scheduleId}:`, error);
                    }
                    
                    // Remove the task from our tracking map
                    scheduledCancelTasks.delete(scheduleId);
                }, {
                    scheduled: true,
                    timezone: "Asia/Jakarta"
                });

                scheduledCancelTasks.set(scheduleId, task);
                scheduledCount++;
                
                logger.info(`📅 Scheduled auto-cancel for schedule ${scheduleId} at ${cancelDeadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
            }
        }

        logger.info(`✅ Dynamic cancel scheduling completed: ${scheduledCount} schedules scheduled for auto-cancel`);
        
        return {
            success: true,
            scheduled_count: scheduledCount,
            total_schedules: schedules.length
        };

    } catch (error) {
        logger.error('❌ Error setting up dynamic cancel scheduling:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Refresh dynamic cancel scheduling (call this when new schedules are created/updated)
 */
const refreshDynamicCancelScheduling = async () => {
    logger.info('🔄 Refreshing dynamic cancel scheduling...');
    return await scheduleDynamicCancelJobs();
};

/**
 * Start dynamic cancel scheduling system
 */
const startDynamicCancelScheduling = () => {
    logger.info('🚀 Starting dynamic cancel scheduling system...');
    
    // Initial scheduling
    scheduleDynamicCancelJobs();
    
    // Refresh scheduling every hour to catch new schedules
    cron.schedule('0 * * * *', async () => {
        logger.info('🔄 Hourly refresh of dynamic cancel scheduling...');
        await refreshDynamicCancelScheduling();
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('✅ Dynamic cancel scheduling system started');
};

/**
 * Legacy cron job untuk auto-cancel (sebagai fallback)
 * Berjalan setiap 15 menit untuk presisi yang lebih baik
 */
const startAutoCancelCron = () => {
    // Schedule: setiap 15 menit
    cron.schedule('*/15 * * * *', async () => {
        logger.info('🕐 Running legacy auto-cancel cron job...');
        
        try {
            const result = await autoCancelExpiredBookings();
            
            if (result.success && result.cancelled_count > 0) {
                logger.info(`✅ Legacy auto-cancel completed: ${result.cancelled_count} bookings cancelled`);
                
                // Log details of cancelled bookings
                result.cancelled_bookings.forEach(booking => {
                    logger.info(`📋 Cancelled booking ${booking.booking_id} for ${booking.member_name} - ${booking.schedule_date} ${booking.schedule_time}`);
                });
            } else {
                logger.info('✅ Legacy auto-cancel completed: No bookings to cancel');
            }
        } catch (error) {
            logger.error('❌ Error in legacy auto-cancel cron job:', error);
            // Don't let the cron job crash the application
            // Just log the error and continue
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('🕐 Legacy auto-cancel cron job scheduled (every 15 minutes)');
};

/**
 * Cron job untuk reminder booking H-1
 * Berjalan setiap hari jam 17:30 (5:30 PM) untuk mengirim reminder kelas besok
 */
const startBookingReminderCron = () => {
    // Schedule: setiap hari jam 17:30
    cron.schedule('30 17 * * *', async () => {
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
            // Don't let the cron job crash the application
            // Just log the error and continue
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('📱 H-1 booking reminder cron job scheduled (daily at 17:30)');
};

/**
 * Start all cron jobs
 */
const startAllCronJobs = () => {
    logger.info('🚀 Starting all booking cron jobs...');
    
    // Start dynamic scheduling (recommended approach)
    startDynamicCancelScheduling();
    
    // Keep legacy cron as fallback (optional - can be disabled)
    // startAutoCancelCron();
    
    startBookingReminderCron();
    
    logger.info('✅ All booking cron jobs started successfully');
};

/**
 * Stop all cron jobs
 */
const stopAllCronJobs = () => {
    logger.info('🛑 Stopping all booking cron jobs...');
    
    // Stop all dynamic scheduled tasks
    scheduledCancelTasks.forEach((task, scheduleId) => {
        task.stop();
        logger.info(`🛑 Stopped dynamic cancel task for schedule: ${scheduleId}`);
    });
    scheduledCancelTasks.clear();
    
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

/**
 * Get current scheduled cancel tasks status
 */
const getScheduledCancelTasksStatus = () => {
    const status = {
        total_scheduled: scheduledCancelTasks.size,
        scheduled_schedules: Array.from(scheduledCancelTasks.keys())
    };
    
    logger.info(`📊 Current scheduled cancel tasks: ${status.total_scheduled} active`);
    return status;
};

module.exports = {
    startAutoCancelCron,
    startBookingReminderCron,
    startAllCronJobs,
    stopAllCronJobs,
    startDynamicCancelScheduling,
    refreshDynamicCancelScheduling,
    scheduleDynamicCancelJobs,
    getScheduledCancelTasksStatus
}; 