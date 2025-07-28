const cron = require('node-cron');
const { sendAllPackageReminders } = require('../utils/packageReminderUtils');
const logger = require('../config/logger');

/**
 * Schedule package reminder cron jobs
 */
const schedulePackageReminders = () => {
    // Send all package reminders every day at 9:00 AM
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

    // Send low session reminders every 3 days at 10:00 AM
    cron.schedule('0 10 */3 * *', async () => {
        try {
            logger.info('🕘 Starting scheduled low session reminders...');
            
            const result = await sendAllPackageReminders();
            
            if (result.success) {
                logger.info(`✅ Scheduled low session reminders completed. Total sent: ${result.low_session.total_sent || 0}`);
            } else {
                logger.error('❌ Scheduled low session reminders failed:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error in scheduled low session reminders:', error);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });

    // Send expiry reminders every week on Monday at 11:00 AM
    cron.schedule('0 11 * * 1', async () => {
        try {
            logger.info('🕘 Starting scheduled expiry reminders...');
            
            const result = await sendAllPackageReminders();
            
            if (result.success) {
                logger.info(`✅ Scheduled expiry reminders completed. Total sent: ${result.expiry.total_sent || 0}`);
            } else {
                logger.error('❌ Scheduled expiry reminders failed:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error in scheduled expiry reminders:', error);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });

    logger.info('📅 Package reminder cron jobs scheduled successfully');
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