const twilio = require('twilio');
const logger = require('../config/logger');

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send WhatsApp message using Twilio
 * @param {string} to - Phone number (with country code, e.g., +6281234567890)
 * @param {string} message - Message content
 * @returns {Promise<Object>} Twilio response
 */
const sendWhatsAppMessage = async (to, message) => {
    try {
        // Format phone number (remove + if exists and add +)
        const formattedPhone = to.startsWith('+') ? to : `+${to}`;
        
        // Determine WhatsApp sender number
        let from;
        if (process.env.TWILIO_WHATSAPP_NUMBER) {
            // Use custom WhatsApp number (business account)
            const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER.startsWith('+') 
                ? process.env.TWILIO_WHATSAPP_NUMBER 
                : `+${process.env.TWILIO_WHATSAPP_NUMBER}`;
            from = `whatsapp:${whatsappNumber}`;
            logger.info(`Using custom WhatsApp number: ${whatsappNumber}`);
        } else {
            // Use Twilio sandbox number (default)
            from = 'whatsapp:+14155238886';
            logger.info('Using Twilio sandbox number (+14155238886)');
        }
        
        const toWhatsApp = `whatsapp:${formattedPhone}`;

        logger.info(`Sending WhatsApp message from ${from} to ${toWhatsApp}`);
        
        const response = await client.messages.create({
            body: message,
            from: from,
            to: toWhatsApp
        });

        logger.info(`WhatsApp message sent successfully. SID: ${response.sid}, Status: ${response.status}`);
        
        return {
            success: true,
            messageId: response.sid,
            status: response.status,
            to: formattedPhone,
            from: from
        };

    } catch (error) {
        logger.error('Error sending WhatsApp message:', error);
        
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.code === 20003) {
            errorMessage = 'Authentication failed - check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN';
        } else if (error.code === 21211) {
            errorMessage = 'Invalid phone number format';
        } else if (error.code === 21614) {
            errorMessage = 'WhatsApp number not registered with Twilio or recipient not in sandbox';
        }
        
        return {
            success: false,
            error: errorMessage,
            errorCode: error.code,
            to: to
        };
    }
};

/**
 * Send booking reminder to member
 * @param {Object} booking - Booking object with member and schedule info
 * @returns {Promise<Object>} Send result
 */
const sendBookingReminder = async (booking) => {
    try {
        const member = booking.Member;
        const schedule = booking.Schedule;
        const classInfo = schedule.Class;
        const trainer = schedule.Trainer;

        // Format schedule time
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

        // Create reminder message
        const message = `🏋️‍♀️ *REMINDER KELAS PILATES* 🏋️‍♀️

Halo ${member.full_name}! 👋

Jangan lupa kelas pilates Anda besok:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${classInfo.class_name}
👨‍🏫 *Trainer*: ${trainer.title}
📍 *Lokasi*: Oblix Pilates Studio

*Status Booking*: ${booking.status === 'signup' ? '✅ Terdaftar' : '⏳ Dalam Antrian'}

💡 *Tips*:
• Datang 10 menit sebelum kelas dimulai
• Bawa handuk dan air minum
• Gunakan pakaian yang nyaman

Jika tidak bisa hadir, silakan cancel booking minimal 2 jam sebelum kelas dimulai.

Terima kasih! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(member.phone_number, message);

    } catch (error) {
        logger.error('Error sending booking reminder:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send booking confirmation
 * @param {Object} booking - Booking object
 * @returns {Promise<Object>} Send result
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

        const message = `✅ *BOOKING BERHASIL* ✅

Halo ${member.full_name}! 👋

Booking kelas pilates Anda berhasil dibuat:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${classInfo.class_name}
📋 *Status*: ${booking.status === 'signup' ? '✅ Terdaftar' : '⏳ Dalam Antrian'}

${booking.status === 'waiting_list' ? '📝 *Catatan*: Anda masuk dalam antrian. Kami akan memberitahu jika ada slot kosong.' : ''}

Kami akan mengirimkan reminder H-1 sebelum kelas dimulai.

Terima kasih telah memilih Oblix Pilates! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(member.phone_number, message);

    } catch (error) {
        logger.error('Error sending booking confirmation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send booking cancellation notification
 * @param {Object} booking - Cancelled booking object
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Send result
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

        const message = `❌ *BOOKING DIBATALKAN* ❌

Halo ${member.full_name}! 👋

Booking kelas pilates Anda telah dibatalkan:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${classInfo.class_name}
📝 *Alasan*: ${reason}

Jika Anda ingin booking ulang, silakan akses aplikasi kami.

Terima kasih! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(member.phone_number, message);

    } catch (error) {
        logger.error('Error sending booking cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send waitlist promotion notification
 * @param {Object} booking - Promoted booking object
 * @returns {Promise<Object>} Send result
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

        const message = `🎉 *SELAMAT! ANDA MASUK KELAS* 🎉

Halo ${member.full_name}! 👋

Selamat! Booking Anda telah dipromosikan dari antrian ke kelas:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${classInfo.class_name}
📋 *Status*: ✅ Terdaftar

Anda sekarang terdaftar untuk kelas ini. Jangan lupa datang tepat waktu!

Kami akan mengirimkan reminder H-1 sebelum kelas dimulai.

Terima kasih! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(member.phone_number, message);

    } catch (error) {
        logger.error('Error sending waitlist promotion:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send class cancellation notification (for insufficient signups)
 * @param {Array} bookings - Array of cancelled bookings
 * @param {Object} schedule - Schedule object
 * @returns {Promise<Array>} Array of send results
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

            const message = `🚫 *KELAS DIBATALKAN* 🚫

Halo ${member.full_name}! 👋

Kelas pilates berikut telah dibatalkan karena tidak memenuhi minimum peserta:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${classInfo.class_name}
📝 *Alasan*: Tidak memenuhi minimum peserta

Booking Anda telah dibatalkan secara otomatis.

Silakan booking kelas lain yang tersedia.

Terima kasih atas pengertiannya! 🙏

*Oblix Pilates Studio*`;

            const result = await sendWhatsAppMessage(member.phone_number, message);
            results.push({
                member_id: member.id,
                member_name: member.full_name,
                ...result
            });
        }

        return results;

    } catch (error) {
        logger.error('Error sending class cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send attendance notification to member
 * @param {string} phoneNumber - Member's phone number
 * @param {string} memberName - Member's full name
 * @param {string} className - Class name
 * @param {string} date - Schedule date
 * @param {string} time - Schedule time
 * @param {string} attendance - Attendance status (absent/late)
 * @returns {Promise<Object>} Send result
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

        const statusEmoji = attendance === 'absent' ? '❌' : '⏰';
        const statusText = attendance === 'absent' ? 'TIDAK HADIR' : 'TERLAMBAT';

        const message = `${statusEmoji} *ABSENSI ${statusText}* ${statusEmoji}

Halo ${memberName}! 👋

Kami mencatat bahwa Anda ${attendance === 'absent' ? 'tidak hadir' : 'terlambat'} pada kelas:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${className}
📊 *Status*: ${statusText}

${attendance === 'absent' 
    ? 'Mohon berikan alasan ketidakhadiran Anda atau hubungi kami untuk informasi lebih lanjut.'
    : 'Untuk kedepannya, mohon datang tepat waktu agar tidak mengganggu jadwal kelas.'
}

Terima kasih! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(phoneNumber, message);

    } catch (error) {
        logger.error('Error sending attendance notification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send class cancellation notification for single booking (admin cancel)
 * @param {string} phoneNumber - Member's phone number
 * @param {string} memberName - Member's full name
 * @param {string} className - Class name
 * @param {string} date - Schedule date
 * @param {string} time - Schedule time
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Send result
 */
const sendAdminCancellation = async (phoneNumber, memberName, className, date, time, reason) => {
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

        const message = `🚫 *BOOKING DIBATALKAN* 🚫

Halo ${memberName}! 👋

Booking Anda untuk kelas berikut telah dibatalkan oleh admin:

📅 *Tanggal*: ${formattedDate}
⏰ *Waktu*: ${formattedTime}
🏷️ *Kelas*: ${className}
📝 *Alasan*: ${reason}

Silakan booking kelas lain yang tersedia atau hubungi kami untuk informasi lebih lanjut.

Terima kasih atas pengertiannya! 🙏

*Oblix Pilates Studio*`;

        return await sendWhatsAppMessage(phoneNumber, message);

    } catch (error) {
        logger.error('Error sending admin cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendWhatsAppMessage,
    sendBookingReminder,
    sendBookingConfirmation,
    sendBookingCancellation,
    sendWaitlistPromotion,
    sendClassCancellation,
    sendAttendanceNotification,
    sendAdminCancellation
}; 