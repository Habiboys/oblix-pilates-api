const axios = require('axios');
const logger = require('../config/logger');
const emailService = require('./email.service');

/**
 * WhatsApp Service using Meta Business API with Template Messages Only
 */
class WhatsAppService {
    constructor() {
        this.accessToken = process.env.META_ACCESS_TOKEN;
        this.phoneNumberId = process.env.META_PHONE_NUMBER_ID;
        this.baseUrl = `https://graph.facebook.com/v20.0/${this.phoneNumberId}`;
        
        if (!this.accessToken || !this.phoneNumberId) {
            logger.error('Meta WhatsApp credentials not configured properly');
        }
    }

    /**
     * Get available templates from Meta API
     * @returns {Promise<Array>} List of available templates
     */
    async getAvailableTemplates() {
        try {
            const response = await axios.get(`${this.baseUrl}/message_templates`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.data || [];
        } catch (error) {
            logger.error('Error getting available templates:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Send template message using Meta API
     * @param {string} to - Phone number
     * @param {string} templateName - Template name (must be approved)
     * @param {Array} parameters - Template parameters
     * @returns {Promise<Object>} Send result
     */
    async sendTemplateMessage(to, templateName, parameters = []) {
        try {
            let formattedPhone = to.replace(/^\+/, '');
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '62' + formattedPhone.substring(1);
            }
            
            logger.info(`Sending template '${templateName}' to ${formattedPhone}`);
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: 'id' // Indonesian
                    }
                }
            };

            // Add parameters if provided
            if (parameters.length > 0) {
                payload.template.components = [
                    {
                        type: 'body',
                        parameters: parameters.map(param => ({
                            type: 'text',
                            text: param
                        }))
                    }
                ];
            }

            const response = await axios.post(`${this.baseUrl}/messages`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`Template message sent successfully. Message ID: ${response.data.messages[0].id}`);
            
            return {
                success: true,
                messageId: response.data.messages[0].id,
                status: response.data.messages[0].message_status || 'sent',
                to: formattedPhone,
                template: templateName
            };

        } catch (error) {
            logger.error(`Error sending template '${templateName}':`, error.response?.data || error.message);
            
            let errorMessage = error.message;
            if (error.response?.data?.error) {
                const metaError = error.response.data.error;
                if (metaError.code === 131051) {
                    errorMessage = `Template '${templateName}' not found or not approved`;
                } else if (metaError.code === 190) {
                    errorMessage = 'Invalid access token';
                } else if (metaError.code === 131000) {
                    errorMessage = 'Template message failed - check template parameters';
                } else {
                    errorMessage = metaError.message || errorMessage;
                }
            }
            
            return {
                success: false,
                error: errorMessage,
                errorCode: error.response?.data?.error?.code,
                to: to,
                template: templateName
            };
        }
    }
}

// Initialize service
const whatsappService = new WhatsAppService();

/**
 * Send booking reminder using template
 */
const sendBookingReminder = async (booking) => {
    try {
        const member = booking.Member;
        const schedule = booking.Schedule;
        const classInfo = schedule.Class;
        const trainer = schedule.Trainer;

        const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Template parameters
        const templateParams = [
            member.full_name,           // {{1}} - nama member
            classInfo.class_name,       // {{2}} - nama kelas  
            formattedDate,              // {{3}} - tanggal
            formattedTime,              // {{4}} - waktu
            trainer.title               // {{5}} - nama trainer
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            member.phone_number, 
            'booking_reminder',
            templateParams
        );

        const emailResult = await emailService.sendBookingReminderEmail(booking);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult
        };

    } catch (error) {
        logger.error('Error sending booking reminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send booking confirmation using template
 */
const sendBookingConfirmation = async (booking) => {
    try {
        const member = booking.Member;
        const schedule = booking.Schedule;
        const classInfo = schedule.Class;

        const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Template parameters
        const templateParams = [
            member.full_name,                                           // {{1}} - nama member
            classInfo.class_name,                                       // {{2}} - nama kelas
            formattedDate,                                              // {{3}} - tanggal
            formattedTime,                                              // {{4}} - waktu
            booking.status === 'signup' ? 'Terdaftar' : 'Dalam Antrian'  // {{5}} - status
        ];

        // Try booking_confirmation template first, fallback to generic if not approved
        let whatsappResult;
        try {
            whatsappResult = await whatsappService.sendTemplateMessage(
                member.phone_number, 
                'booking_confirmation',
                templateParams
            );
        } catch (error) {
            if (error.response?.data?.error?.code === 132001) {
                // Template not approved, use generic template
                logger.warn('Template booking_confirmation not approved, using fallback');
                whatsappResult = await whatsappService.sendTemplateMessage(
                    member.phone_number, 
                    'generic_booking_notification',
                    [member.full_name, classInfo.class_name, formattedDate, formattedTime]
                );
            } else {
                throw error;
            }
        }

        const emailResult = await emailService.sendBookingConfirmationEmail(booking);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult,
            member_name: member.full_name
        };

    } catch (error) {
        logger.error('Error sending booking confirmation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send booking cancellation using template
 */
const sendBookingCancellation = async (booking, reason = 'Booking dibatalkan') => {
    try {
        const member = booking.Member;
        const schedule = booking.Schedule;
        const classInfo = schedule.Class;

        const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Template parameters
        const templateParams = [
            member.full_name,           // {{1}} - nama member
            classInfo.class_name,       // {{2}} - nama kelas
            formattedDate,              // {{3}} - tanggal
            formattedTime,              // {{4}} - waktu
            reason                      // {{5}} - alasan
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            member.phone_number, 
            'booking_cancellation',
            templateParams
        );

        const emailResult = await emailService.sendBookingCancellationEmail(booking, reason);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult,
            member_name: member.full_name
        };

    } catch (error) {
        logger.error('Error sending booking cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send waitlist promotion using template
 */
const sendWaitlistPromotion = async (booking) => {
    try {
        const member = booking.Member;
        const schedule = booking.Schedule;
        const classInfo = schedule.Class;

        const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Template parameters
        const templateParams = [
            member.full_name,           // {{1}} - nama member
            classInfo.class_name,       // {{2}} - nama kelas
            formattedDate,              // {{3}} - tanggal
            formattedTime               // {{4}} - waktu
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            member.phone_number, 
            'waitlist_promotion',
            templateParams
        );

        const emailResult = await emailService.sendWaitlistPromotionEmail(booking);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult,
            member_name: member.full_name
        };

    } catch (error) {
        logger.error('Error sending waitlist promotion:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send class cancellation using template
 */
const sendClassCancellation = async (bookings, schedule) => {
    try {
        const classInfo = schedule.Class;
        const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const results = [];

        for (const booking of bookings) {
            const member = booking.Member;

            // Template parameters
            const templateParams = [
                member.full_name,           // {{1}} - nama member
                classInfo.class_name,       // {{2}} - nama kelas
                formattedDate,              // {{3}} - tanggal
                formattedTime               // {{4}} - waktu
            ];

            const whatsappResult = await whatsappService.sendTemplateMessage(
                member.phone_number, 
                'class_cancellation',
                templateParams
            );

            results.push({
                member_id: member.id,
                member_name: member.full_name,
                whatsapp: whatsappResult
            });
        }

        // Send email notifications
        try {
            const emailResults = await emailService.sendClassCancellationEmail(bookings, schedule);
            
            for (let i = 0; i < results.length; i++) {
                if (emailResults[i]) {
                    results[i].email = emailResults[i];
                } else {
                    results[i].email = { success: false, error: 'No email result returned' };
                }
            }
        } catch (error) {
            logger.error('Error sending class cancellation emails:', error);
            for (const result of results) {
                result.email = { success: false, error: error.message };
            }
        }

        return results.map(result => ({
            ...result,
            success: (result.whatsapp && result.whatsapp.success) || (result.email && result.email.success)
        }));

    } catch (error) {
        logger.error('Error sending class cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send attendance notification using template
 */
const sendAttendanceNotification = async (phoneNumber, memberName, className, date, time, attendance) => {
    try {
        const scheduleDate = new Date(`${date}T${time}`);
        const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusText = attendance === 'absent' ? 'Tidak Hadir' : 'Terlambat';

        // Template parameters
        const templateParams = [
            memberName,                 // {{1}} - nama member
            className,                  // {{2}} - nama kelas
            formattedDate,              // {{3}} - tanggal
            formattedTime,              // {{4}} - waktu
            statusText                  // {{5}} - status kehadiran
        ];

        const templateName = attendance === 'absent' ? 'attendance_absent' : 'attendance_late';

        return await whatsappService.sendTemplateMessage(phoneNumber, templateName, templateParams);

    } catch (error) {
        logger.error('Error sending attendance notification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send admin cancellation using template
 */
const sendAdminCancellation = async (phoneNumber, memberName, className, date, time, reason) => {
    try {
        // Template parameters
        const templateParams = [
            memberName,                 // {{1}} - nama member
            className,                  // {{2}} - nama kelas
            date,                       // {{3}} - tanggal
            time,                       // {{4}} - waktu
            reason                      // {{5}} - alasan pembatalan
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            phoneNumber, 
            'admin_cancellation',
            templateParams
        );
        
        return {
            success: whatsappResult.success,
            whatsapp: whatsappResult,
            member_name: memberName
        };

    } catch (error) {
        logger.error('Error sending admin cancellation notification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send low session reminder using template
 */
const sendLowSessionReminder = async (reminderData) => {
    try {
        const { member_name, phone_number, package_name, remaining_sessions, end_date, days_remaining } = reminderData;

        // Template parameters
        const templateParams = [
            member_name,                // {{1}} - nama member
            package_name,               // {{2}} - nama paket
            remaining_sessions.toString(), // {{3}} - sesi tersisa
            end_date,                   // {{4}} - tanggal berakhir
            days_remaining.toString()   // {{5}} - hari tersisa
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            phone_number, 
            'low_session_reminder',
            templateParams
        );

        const emailResult = await emailService.sendLowSessionReminderEmail(reminderData);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult
        };

    } catch (error) {
        logger.error('Error sending low session reminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send expiry reminder using template
 */
const sendExpiryReminder = async (reminderData) => {
    try {
        const { member_name, phone_number, package_name, remaining_sessions, end_date, days_remaining } = reminderData;

        // Template parameters
        const templateParams = [
            member_name,                // {{1}} - nama member
            package_name,               // {{2}} - nama paket
            remaining_sessions.toString(), // {{3}} - sesi tersisa
            end_date,                   // {{4}} - tanggal berakhir
            days_remaining.toString()   // {{5}} - hari tersisa
        ];

        const whatsappResult = await whatsappService.sendTemplateMessage(
            phone_number, 
            'expiry_reminder',
            templateParams
        );

        const emailResult = await emailService.sendExpiryReminderEmail(reminderData);
        
        return {
            success: whatsappResult.success || emailResult.success,
            whatsapp: whatsappResult,
            email: emailResult
        };

    } catch (error) {
        logger.error('Error sending expiry reminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Export functions
module.exports = {
    // Core service
    sendTemplateMessage: (to, templateName, parameters) => whatsappService.sendTemplateMessage(to, templateName, parameters),
    getAvailableTemplates: () => whatsappService.getAvailableTemplates(),
    
    // Booking functions
    sendBookingReminder,
    sendBookingConfirmation,
    sendBookingCancellation,
    sendWaitlistPromotion,
    sendClassCancellation,
    
    // Other functions
    sendAttendanceNotification,
    sendAdminCancellation,
    sendLowSessionReminder,
    sendExpiryReminder
};