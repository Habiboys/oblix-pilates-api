const cron = require('node-cron');
const { sendAllPackageReminders } = require('../utils/packageReminderUtils');
const logger = require('../config/logger');

/**
 * Schedule package reminder cron jobs
 * Reminder berdasarkan field reminder_session dan reminder_day dari masing-masing paket
 */
const schedulePackageReminders = () => {
    // Send all package reminders every day at 9:00 AM
    // Reminder akan dikirim berdasarkan konfigurasi per paket (reminder_session & reminder_day)
    cron.schedule('0 9 * * *', async () => {
        try {
            logger.info('🕘 Starting scheduled package reminders...');
            
            const result = await sendAllPackageReminders();
            
            if (result.success) {
                logger.info(`✅ Scheduled package reminders completed. Total sent: ${result.total_sent}`);
                logger.info(`📊 Low session reminders: ${result.low_session.total_sent || 0}`);
                logger.info(`📊 Expiry reminders: ${result.expiry.total_sent || 0}`);
            } else {
                logger.error('❌ Scheduled package reminders failed:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error in scheduled package reminders:', error);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });



    logger.info('📅 Package reminder cron job scheduled successfully (daily at 9:00 AM)');
};

/**
 * Start all reminder cron jobs
 */
const startReminderCronJobs = () => {
    try {
        schedulePackageReminders();
        logger.info('✅ All reminder cron jobs started successfully');
    } catch (error) {
        logger.error('❌ Error starting reminder cron jobs:', error);
    }
};

/**
 * Stop all reminder cron jobs
 */
const stopReminderCronJobs = () => {
    try {
        cron.getTasks().forEach(task => {
            if (task.options && task.options.name && task.options.name.includes('reminder')) {
                task.stop();
                logger.info(`🛑 Stopped reminder cron job: ${task.options.name}`);
            }
        });
        logger.info('✅ All reminder cron jobs stopped successfully');
    } catch (error) {
        logger.error('❌ Error stopping reminder cron jobs:', error);
    }
};

module.exports = {
    startReminderCronJobs,
    stopReminderCronJobs,
    schedulePackageReminders
}; 