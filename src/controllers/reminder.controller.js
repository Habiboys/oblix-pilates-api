const { sendLowSessionReminder, sendExpiryReminder, sendAllPackageReminders } = require('../utils/packageReminderUtils');
const logger = require('../config/logger');

/**
 * Send low session reminder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendLowSessionReminderController = async (req, res) => {
    try {
        const { remaining_sessions = 2 } = req.body;

        logger.info(`📱 Manual low session reminder triggered (${remaining_sessions} sessions remaining)`);

        const result = await sendLowSessionReminder(remaining_sessions);

        if (result.success) {
            res.json({
                success: true,
                message: `Low session reminder sent successfully`,
                data: {
                    total_sent: result.total_sent,
                    reminders: result.reminders,
                    threshold: remaining_sessions
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send low session reminders',
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error in sendLowSessionReminderController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Send expiry reminder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendExpiryReminderController = async (req, res) => {
    try {
        const { days_before_expiry = 7 } = req.body;

        logger.info(`📱 Manual expiry reminder triggered (${days_before_expiry} days before expiry)`);

        const result = await sendExpiryReminder(days_before_expiry);

        if (result.success) {
            res.json({
                success: true,
                message: `Expiry reminder sent successfully`,
                data: {
                    total_sent: result.total_sent,
                    reminders: result.reminders,
                    threshold: days_before_expiry
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send expiry reminders',
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error in sendExpiryReminderController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Send all package reminders
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendAllPackageRemindersController = async (req, res) => {
    try {
        logger.info('📱 Manual all package reminders triggered');

        const result = await sendAllPackageReminders();

        if (result.success) {
            res.json({
                success: true,
                message: `All package reminders sent successfully`,
                data: {
                    total_sent: result.total_sent,
                    low_session: result.low_session,
                    expiry: result.expiry
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send package reminders',
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error in sendAllPackageRemindersController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    sendLowSessionReminderController,
    sendExpiryReminderController,
    sendAllPackageRemindersController
}; 