const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Clean up old log files from the logs directory
 * Default retention: 3 days
 */
const cleanupOldLogs = async () => {
    try {
        const logDir = path.join(__dirname, '../../logs');

        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            logger.warn('⚠️ Log directory not found, skipping cleanup.');
            return;
        }

        const files = fs.readdirSync(logDir);
        const now = new Date();
        const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 3;
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        logger.info(`🧹 Starting log cleanup (Retention: ${retentionDays} days)...`);

        files.forEach(file => {
            const filePath = path.join(logDir, file);

            // Only process .log files
            if (path.extname(file) === '.log') {
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtime; // Use modification time

                if (fileAge > retentionMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    logger.info(`🗑️ Deleted old log file: ${file}`);
                }
            }
        });

        if (deletedCount > 0) {
            logger.info(`✅ Log cleanup completed: ${deletedCount} files deleted.`);
        } else {
            logger.info('✅ Log cleanup completed: No files to delete.');
        }

    } catch (error) {
        logger.error('❌ Error during log cleanup:', error);
    }
};

/**
 * Schedule the log cleanup cron job
 * Runs daily at midnight (00:00)
 */
const startLogCleanupCron = () => {
    // Schedule: daily at 00:00
    cron.schedule('0 0 * * *', async () => {
        logger.info('🕐 Running scheduled log cleanup...');
        await cleanupOldLogs();
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('🧹 Log cleanup cron job scheduled (daily at 00:00)');

    // Run cleanup once on startup just in case
    // cleanupOldLogs(); 
};

module.exports = {
    startLogCleanupCron,
    cleanupOldLogs // Exported for manual testing if needed
};
