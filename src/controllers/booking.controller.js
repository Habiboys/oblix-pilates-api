const { Booking, Schedule, Member, Package, MemberPackage } = require('../models');
const { validateSessionAvailability, createSessionAllocation, getMemberSessionSummary, getBestPackageForBooking } = require('../utils/sessionTrackingUtils');
const { autoCancelExpiredBookings, processWaitlistPromotion } = require('../utils/bookingUtils');
const { validateMemberScheduleConflict } = require('../utils/scheduleUtils');
const { updateSessionUsage } = require('../utils/sessionTrackingUtils');
const twilioService = require('../services/twilio.service');
const logger = require('../config/logger');




// Create booking for authenticated user
const createUserBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const { schedule_id } = req.body;

        // Validasi input
        if (!schedule_id) {
            return res.status(400).json({
                success: false,
                message: 'schedule_id harus diisi'
            });
        }

        // Get member ID from user ID
        const member = await Member.findOne({
            where: { user_id: userId }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const member_id = member.id;

        // Cek apakah schedule exists dan valid untuk booking
        const schedule = await Schedule.findByPk(schedule_id);
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule tidak ditemukan'
            });
        }

        // Validasi bahwa schedule adalah group atau semi-private
        if (schedule.type === 'private') {
            return res.status(400).json({
                success: false,
                message: 'Booking hanya tersedia untuk schedule group dan semi-private. Schedule private menggunakan auto-booking.'
            });
        }

        // Cek apakah schedule sudah lewat waktu
        const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const currentDateTime = new Date();
        
        if (scheduleDateTime <= currentDateTime) {
            return res.status(400).json({
                success: false,
                message: 'Tidak dapat booking untuk schedule yang sudah lewat waktu'
            });
        }

        // Cek kapasitas schedule dan tentukan status booking
        const currentSignups = await Booking.count({
            where: {
                schedule_id: schedule_id,
                status: 'signup'
            }
        });

        const maxCapacity = schedule.pax || 20;
        const minSignup = schedule.min_signup || 1;
        
        // Cek apakah sudah ada booking untuk member ini di schedule ini
        const existingBooking = await Booking.findOne({
            where: {
                schedule_id,
                member_id
            },
            order: [['createdAt', 'DESC']] // Ambil booking terbaru
        });

        if (existingBooking) {
            // Jika ada booking dengan status aktif, tidak boleh booking lagi
            if (['signup', 'waiting_list'].includes(existingBooking.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda sudah melakukan booking untuk schedule ini'
                });
            }
        }

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah melakukan booking untuk schedule ini'
            });
        }

        // Validasi konflik jadwal member
        const memberConflict = await validateMemberScheduleConflict(
            member_id,
            schedule.date_start,
            schedule.time_start,
            schedule.time_end
        );

        if (memberConflict.hasConflict) {
            return res.status(400).json({
                success: false,
                message: 'Anda memiliki jadwal yang bentrok dengan schedule ini',
                data: {
                    conflicts: memberConflict.conflicts
                }
            });
        }

        // Cek ketersediaan sesi berdasarkan tipe schedule dengan sistem prioritas
        let scheduleType = 'group';
        if (schedule.type === 'private') {
            scheduleType = 'private';
        } else if (schedule.type === 'semi_private') {
            scheduleType = 'semi_private';
        }

        // Cek apakah member memiliki session yang sesuai menggunakan sistem prioritas
        let bestPackage = null;
        try {
            bestPackage = await getBestPackageForBooking(member_id, scheduleType);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
                data: {
                    schedule_type: scheduleType,
                    required_sessions: 1
                }
            });
        }

        if (!bestPackage) {
            return res.status(400).json({
                success: false,
                message: `Tidak ada paket yang tersedia untuk booking ${scheduleType} class`,
                data: {
                    schedule_type: scheduleType,
                    required_sessions: 1
                }
            });
        }

        // Tentukan status booking (setelah memastikan member punya sesi)
        let bookingStatus = 'signup';
        let bookingNotes = 'User booking';

        if (currentSignups >= maxCapacity) {
            bookingStatus = 'waiting_list';
            bookingNotes = 'Booking masuk waitlist karena kelas penuh';
        }

        const selectedPackageId = bestPackage.package_id;

        let booking;
        let isReusedBooking = false;

        // Jika ada existing booking dengan status cancelled, gunakan itu
        if (existingBooking && existingBooking.status === 'cancelled') {
            // Update existing booking
            await existingBooking.update({
                status: bookingStatus,
                booking_date: new Date(),
                notes: bookingNotes,
                cancelled_by: null // Reset cancelled_by
            });
            booking = existingBooking;
            isReusedBooking = true;
            logger.info(`♻️ Reusing cancelled booking ${existingBooking.id} for member ${member_id}`);
        } else {
            // Buat booking baru
            booking = await Booking.create({
                schedule_id,
                member_id,
                package_id: selectedPackageId,
                status: bookingStatus,
                booking_date: new Date(),
                notes: bookingNotes
            });
            logger.info(`🆕 Created new booking ${booking.id} for member ${member_id}`);
        }

        // Fetch booking dengan associations
        const createdBooking = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'username', 'member_code', 'phone_number']
                },
                {
                    model: Schedule,
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
                    model: Package,
                    attributes: ['id', 'name', 'type']
                }
            ]
        });

        // Update session usage untuk member package
        try {
            // Cari member package ID
            const memberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id,
                    package_id: selectedPackageId
                }
            });
            
            logger.info(`🔍 Looking for member package: member_id=${member_id}, package_id=${selectedPackageId}`);
            logger.info(`📦 Found member package: ${memberPackage ? memberPackage.id : 'NOT FOUND'}`);
            
            if (memberPackage) {
                logger.info(`🔄 Updating session usage for member package ${memberPackage.id}`);
                const updateResult = await updateSessionUsage(memberPackage.id, member_id, selectedPackageId, booking.id);
                logger.info(`✅ Session usage updated successfully:`, updateResult);
            } else {
                logger.error(`❌ Member package not found for member_id=${member_id}, package_id=${selectedPackageId}`);
            }
        } catch (error) {
            logger.error(`❌ Failed to update session usage: ${error.message}`);
            logger.error(`❌ Error stack: ${error.stack}`);
        }

        // Send WhatsApp confirmation (async, don't wait for response)
        try {
            twilioService.sendBookingConfirmation(createdBooking)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp confirmation sent to ${createdBooking.Member.full_name}`);
                    } else {
                        logger.error(`❌ Failed to send WhatsApp confirmation to ${createdBooking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending WhatsApp confirmation to ${createdBooking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating WhatsApp confirmation:', error);
        }

        res.status(201).json({
            success: true,
            message: isReusedBooking ? 'Booking berhasil diaktifkan kembali' : 'Booking berhasil dibuat',
            data: {
                booking_id: createdBooking.id,
                status: createdBooking.status,
                schedule: {
                    id: createdBooking.Schedule.id,
                    date: createdBooking.Schedule.date_start,
                    time: `${createdBooking.Schedule.time_start} - ${createdBooking.Schedule.time_end}`,
                    class: createdBooking.Schedule.Class.class_name,
                    trainer: createdBooking.Schedule.Trainer.title
                },
                package: {
                    id: createdBooking.Package.id,
                    name: createdBooking.Package.name,
                    type: createdBooking.Package.type
                },
                notes: createdBooking.notes,
                created_at: createdBooking.createdAt
            }
        });
    } catch (error) {
        logger.error('Error creating user booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update booking status
const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class
                        }
                    ]
                }
            ]
        });
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Validasi status
        const validStatuses = ['signup', 'waiting_list', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status tidak valid'
            });
        }

        const oldStatus = booking.status;
        
        // Update booking
        await booking.update({
            status: status || booking.status,
            notes: notes || booking.notes,
            cancelled_by: status === 'cancelled' ? req.user.id : null
        });

        // Update session usage jika status berubah dari waiting_list ke signup
        if (oldStatus === 'waiting_list' && status === 'signup') {
            try {
                const memberPackage = await require('../models').MemberPackage.findOne({
                    where: {
                        member_id: booking.member_id,
                        package_id: booking.package_id
                    }
                });
                
                if (memberPackage) {
                    await updateSessionUsage(memberPackage.id, booking.member_id, booking.package_id);
                    logger.info(`✅ Session usage updated after status change from waiting_list to signup for member ${booking.member_id}`);
                }
            } catch (error) {
                logger.error(`❌ Failed to update session usage after status change: ${error.message}`);
            }
        }

        // Jika booking di-cancel, cek waitlist untuk naik ke signup
        if (status === 'cancelled') {
            await processWaitlistPromotion(booking.schedule_id);
        }

        res.json({
            success: true,
            message: 'Booking status updated successfully',
            data: booking
        });
    } catch (error) {
        logger.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};


// Cancel booking for authenticated user
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const cancelReason = reason || 'Booking dibatalkan oleh user';

        const booking = await Booking.findOne({
            where: {
                id: id,
            },
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class
                        }
                    ]
                },
                {
                    model: Member
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Cek apakah booking sudah di-cancel
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking sudah di-cancel sebelumnya'
            });
        }

        // Cek cancel buffer time
        const scheduleDateTime = new Date(`${booking.Schedule.date_start}T${booking.Schedule.time_start}`);
        const currentDateTime = new Date();
        const cancelBufferMinutes = booking.Schedule.cancel_buffer_minutes || 120; // Default 2 jam
        const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

        if (currentDateTime > cancelDeadline) {
            return res.status(400).json({
                success: false,
                message: `Tidak dapat cancel booking. Batas waktu cancel adalah ${cancelBufferMinutes} menit sebelum kelas dimulai.`,
                data: {
                    schedule_time: scheduleDateTime,
                    cancel_deadline: cancelDeadline,
                    current_time: currentDateTime
                }
            });
        }

        // Cancel booking
        await booking.update({
            status: 'cancelled',
            notes: cancelReason,
            cancelled_by: req.user.id // User yang melakukan cancel
        });

        // Send WhatsApp cancellation notification (async)
        try {
            twilioService.sendBookingCancellation(booking, cancelReason)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp cancellation sent to ${booking.Member.full_name}`);
                    } else {
                        logger.error(`❌ Failed to send WhatsApp cancellation to ${booking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending WhatsApp cancellation to ${booking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating WhatsApp cancellation:', error);
        }

        // Update session usage setelah cancel booking
        try {
            const memberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id: booking.member_id,
                    package_id: booking.package_id
                }
            });
            
            if (memberPackage) {
                await updateSessionUsage(memberPackage.id, booking.member_id, booking.package_id);
                logger.info(`✅ Session usage updated after canceling booking for member ${booking.member_id}`);
            }
        } catch (error) {
            logger.error(`❌ Failed to update session usage after cancel: ${error.message}`);
        }

        // Process waitlist promotion jika booking yang di-cancel adalah signup
        let promotionResult = null;
        if (booking.status === 'signup') {
            try {
                promotionResult = await processWaitlistPromotion(booking.schedule_id);
                if (promotionResult) {
                    logger.info(`✅ Waitlist promotion successful for schedule ${booking.schedule_id}. Promoted: ${promotionResult.Member?.full_name}`);
                } else {
                    logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id}`);
                }
            } catch (error) {
                logger.error(`❌ Failed to process waitlist promotion: ${error.message}`);
            }
        }

        res.json({
            success: true,
            message: 'Booking berhasil dibatalkan',
            data: {
                booking_id: booking.id,
                schedule_id: booking.schedule_id,
                member_name: booking.Member.full_name,
                class_name: booking.Schedule.Class.class_name,
                schedule_date: booking.Schedule.date_start,
                schedule_time: booking.Schedule.time_start,
                status: booking.status,
                cancelled_at: booking.updatedAt,
                promoted_from_waitlist: promotionResult ? {
                    member_name: promotionResult.Member?.full_name,
                    member_phone: promotionResult.Member?.phone_number,
                    booking_id: promotionResult.id,
                    promoted_at: promotionResult.updatedAt
                } : null
            }
        });
    } catch (error) {
        logger.error('Error cancelling user booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Admin cancel booking
const adminCancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const cancelReason = reason || 'Booking dibatalkan oleh admin';

        const booking = await Booking.findOne({
            where: {
                id: id,
            },
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class
                        }
                    ]
                },
                {
                    model: Member,
                    include: [
                        {
                            model: require('../models').User
                        }
                    ]
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Cek apakah booking sudah di-cancel
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking sudah di-cancel sebelumnya'
            });
        }

        // Cancel booking
        await booking.update({
            status: 'cancelled',
            notes: cancelReason,
            cancelled_by: req.user.id // Admin yang melakukan cancel
        });

        // Send WhatsApp cancellation notification (async)
        try {
            twilioService.sendAdminCancellation(
                booking.Member.phone_number,
                booking.Member.full_name,
                booking.Schedule.Class.class_name,
                booking.Schedule.date_start,
                booking.Schedule.time_start,
                cancelReason
            ).then(result => {
                if (result.success) {
                    logger.info(`✅ Admin cancellation WhatsApp sent to ${booking.Member.full_name}`);
                } else {
                    logger.error(`❌ Failed to send admin cancellation WhatsApp to ${booking.Member.full_name}: ${result.error}`);
                }
            }).catch(error => {
                logger.error(`❌ Error sending admin cancellation WhatsApp to ${booking.Member.full_name}:`, error);
            });
        } catch (error) {
            logger.error('Error initiating admin cancellation WhatsApp:', error);
        }

        // Update session usage setelah cancel booking
        try {
            const memberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id: booking.member_id,
                    package_id: booking.package_id
                }
            });
            
            if (memberPackage) {
                await updateSessionUsage(memberPackage.id, booking.member_id, booking.package_id);
                logger.info(`✅ Session usage updated after admin canceling booking for member ${booking.member_id}`);
            }
        } catch (error) {
            logger.error(`❌ Failed to update session usage after admin cancel: ${error.message}`);
        }

        // Process waitlist promotion jika booking yang di-cancel adalah signup
        let promotionResult = null;
        if (booking.status === 'signup') {
            try {
                promotionResult = await processWaitlistPromotion(booking.schedule_id);
                if (promotionResult) {
                    logger.info(`✅ Waitlist promotion successful for schedule ${booking.schedule_id}. Promoted: ${promotionResult.Member?.full_name}`);
                } else {
                    logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id}`);
                }
            } catch (error) {
                logger.error(`❌ Failed to process waitlist promotion: ${error.message}`);
            }
        }

        res.json({
            success: true,
            message: 'Booking berhasil dibatalkan oleh admin',
            data: {
                booking_id: booking.id,
                schedule_id: booking.schedule_id,
                member_name: booking.Member.full_name,
                member_email: booking.Member.User?.email || '',
                class_name: booking.Schedule.Class.class_name,
                schedule_date: booking.Schedule.date_start,
                schedule_time: booking.Schedule.time_start,
                status: booking.status,
                cancelled_at: booking.updatedAt,
                cancelled_by: req.user.id,
                cancel_reason: cancelReason,
                promoted_from_waitlist: promotionResult ? {
                    member_name: promotionResult.Member?.full_name,
                    member_phone: promotionResult.Member?.phone_number,
                    booking_id: promotionResult.id,
                    promoted_at: promotionResult.updatedAt
                } : null
            }
        });
    } catch (error) {
        logger.error('Error admin cancelling booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};




// Update attendance status
const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { attendance, notes } = req.body;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number'],
                    include: [
                        {
                            model: require('../models').User,
                            attributes: ['email']
                        }
                    ]
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['class_name']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['title']
                        }
                    ]
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Update attendance
        await booking.update({
            attendance,
            notes: notes || booking.notes
        });

        res.json({
            success: true,
            message: 'Attendance updated successfully',
            data: {
                id: booking.id,
                attendance: booking.attendance,
                notes: booking.notes,
                updated_at: booking.updatedAt
            }
        });
    } catch (error) {
        logger.error('Error updating attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update attendance for all bookings in a schedule
const updateScheduleAttendance = async (req, res) => {
    try {
        const { schedule_id } = req.params;
        const { attendances } = req.body; // Array of { booking_id, attendance, notes }

        // Validate schedule exists
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [
                {
                    model: require('../models').Class,
                    attributes: ['class_name']
                },
                {
                    model: require('../models').Trainer,
                    attributes: ['title']
                }
            ]
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Get all signup bookings for this schedule
        const bookings = await Booking.findAll({
            where: {
                schedule_id,
                status: 'signup'
            },
            attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number'],
                    include: [
                        {
                            model: require('../models').User,
                            attributes: ['email']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        if (bookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No signup bookings found for this schedule'
            });
        }

        const results = [];

        // Update each booking attendance
        for (const booking of bookings) {
            const attendanceData = attendances.find(a => a.booking_id === booking.id);
            
            if (attendanceData) {
                await booking.update({
                    attendance: attendanceData.attendance,
                    notes: attendanceData.notes || booking.notes
                });

                results.push({
                    booking_id: booking.id,
                    member_id: booking.member_id,
                    member_name: booking.Member.full_name,
                    attendance: booking.attendance,
                    notes: booking.notes,
                    updated_at: booking.updatedAt
                });
            } else {
                // Default to present if not specified
                await booking.update({
                    attendance: 'present'
                });

                results.push({
                    booking_id: booking.id,
                    member_id: booking.member_id,
                    member_name: booking.Member.full_name,
                    attendance: 'present',
                    notes: booking.notes,
                    updated_at: booking.updatedAt
                });
            }
        }

        res.json({
            success: true,
            message: 'Schedule attendance updated successfully',
            data: {
                schedule_id,
                schedule_info: {
                    class_name: schedule.Class.class_name,
                    trainer_name: schedule.Trainer.title,
                    date: schedule.date_start,
                    time: schedule.time_start
                },
                total_bookings: bookings.length,
                updated_bookings: results
            }
        });
    } catch (error) {
        logger.error('Error updating schedule attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};



module.exports = {
    updateBookingStatus,
    updateAttendance,
    updateScheduleAttendance,
    createUserBooking,
    cancelBooking,
    adminCancelBooking
}; 