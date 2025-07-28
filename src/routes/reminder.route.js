const express = require('express');
const router = express.Router();
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const reminderController = require('../controllers/reminder.controller');

// Send low session reminder
router.post('/low-session', 
    validateToken, 
    checkRole('admin'), 
    reminderController.sendLowSessionReminderController
);

// Send expiry reminder
router.post('/expiry', 
    validateToken, 
    checkRole('admin'), 
    reminderController.sendExpiryReminderController
);

// Send all package reminders
router.post('/all', 
    validateToken, 
    checkRole('admin'), 
    reminderController.sendAllPackageRemindersController
);

module.exports = router; 