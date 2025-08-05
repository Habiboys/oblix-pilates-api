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

        // Cek booking deadline hour
        const bookingDeadline = new Date(scheduleDateTime.getTime() - (schedule.booking_deadline_hour * 60 * 60 * 1000));
        
        if (currentDateTime >= bookingDeadline) {
            return res.status(400).json({
                success: false,
                message: `Booking sudah ditutup. Deadline booking adalah ${schedule.booking_deadline_hour} jam sebelum kelas dimulai`,
                data: {
                    schedule_start: scheduleDateTime,
                    booking_deadline: bookingDeadline,
                    booking_deadline_hour: schedule.booking_deadline_hour
                }
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
            // Jika status cancelled, akan di-reuse nanti (tidak perlu return error)
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

        // PERBAIKAN: Gunakan member_package_id untuk tracking session yang benar
        const selectedPackageId = bestPackage.package_id;
        const selectedMemberPackageId = bestPackage.member_package_id;

        // Tentukan status booking (setelah memastikan member punya sesi)
        let bookingStatus = 'signup';
        let bookingNotes = `User booking - MemberPackageID: ${selectedMemberPackageId}`;

        logger.info(`📊 Booking capacity check: currentSignups=${currentSignups}, maxCapacity=${maxCapacity}, schedule_id=${schedule_id}`);
        logger.info(`📊 Existing booking status: ${existingBooking ? existingBooking.status : 'none'}`);

        if (currentSignups >= maxCapacity) {
            bookingStatus = 'waiting_list';
            bookingNotes = `Booking masuk waitlist karena kelas penuh - MemberPackageID: ${selectedMemberPackageId}`;
            logger.info(`⏳ Booking will be waitlist: currentSignups (${currentSignups}) >= maxCapacity (${maxCapacity})`);
        } else {
            logger.info(`✅ Booking will be signup: currentSignups (${currentSignups}) < maxCapacity (${maxCapacity})`);
        }

        let booking;
        let isReusedBooking = false;

        // Jika ada existing booking dengan status cancelled, gunakan itu
        if (existingBooking && existingBooking.status === 'cancelled') {
            // PERBAIKAN: Cek ulang kapasitas saat ini sebelum reuse booking
            const currentSignupsAfterCancel = await Booking.count({
                where: {
                    schedule_id: schedule_id,
                    status: 'signup'
                }
            });
            
            logger.info(`📊 Rechecking capacity after cancel: currentSignupsAfterCancel=${currentSignupsAfterCancel}, maxCapacity=${maxCapacity}`);
            
            // PERBAIKAN: Cek apakah ada member di waitlist yang harus diprioritaskan
            const waitlistCount = await Booking.count({
                where: {
                    schedule_id: schedule_id,
                    status: 'waiting_list'
                }
            });
            
            logger.info(`📊 Waitlist check before reuse: ${waitlistCount} members in waitlist`);
            
            // Update booking status berdasarkan kapasitas saat ini
            let finalBookingStatus = 'signup';
            let finalBookingNotes = `User booking (reused) - MemberPackageID: ${selectedMemberPackageId}`;
            
            if (currentSignupsAfterCancel >= maxCapacity) {
                finalBookingStatus = 'waiting_list';
                finalBookingNotes = `Booking masuk waitlist karena kelas penuh (reused) - MemberPackageID: ${selectedMemberPackageId}`;
                logger.info(`⏳ Reused booking will be waitlist: currentSignupsAfterCancel (${currentSignupsAfterCancel}) >= maxCapacity (${maxCapacity})`);
            } else if (waitlistCount > 0) {
                // PERBAIKAN: Jika ada member di waitlist, booking baru harus masuk waitlist
                finalBookingStatus = 'waiting_list';
                finalBookingNotes = `Booking masuk waitlist karena ada member lain di waitlist (reused) - MemberPackageID: ${selectedMemberPackageId}`;
                logger.info(`⏳ Reused booking will be waitlist: ada ${waitlistCount} member di waitlist yang harus diprioritaskan`);
            } else {
                logger.info(`✅ Reused booking will be signup: currentSignupsAfterCancel (${currentSignupsAfterCancel}) < maxCapacity (${maxCapacity}) dan tidak ada waitlist`);
            }
            
            // Update existing booking
            const updateData = {
                status: finalBookingStatus,
                booking_date: new Date(),
                notes: finalBookingNotes,
                cancelled_by: null // Reset cancelled_by
            };
            
            // Set waitlist_joined_at jika masuk waitlist
            if (finalBookingStatus === 'waiting_list') {
                updateData.waitlist_joined_at = new Date();
                logger.info(`⏰ Set waitlist_joined_at for reused booking ${existingBooking.id}`);
            }
            
            await existingBooking.update(updateData);
            booking = existingBooking;
            isReusedBooking = true;
            logger.info(`♻️ Reusing cancelled booking ${existingBooking.id} for member ${member_id} with status: ${finalBookingStatus}`);
        } else {
            // Buat booking baru
            const bookingData = {
                schedule_id,
                member_id,
                package_id: selectedPackageId,
                status: bookingStatus,
                booking_date: new Date(),
                notes: bookingNotes
            };
            
            // Set waitlist_joined_at jika masuk waitlist
            if (bookingStatus === 'waiting_list') {
                bookingData.waitlist_joined_at = new Date();
                logger.info(`⏰ Set waitlist_joined_at for new booking`);
            }
            
            booking = await Booking.create(bookingData);
            logger.info(`🆕 Created new booking ${booking.id} for member ${member_id}`);
        }

        // Fetch booking dengan associations
        const createdBooking = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'username', 'member_code', 'phone_number'],
                    include: [
                        {
                            model: require('../models').User,
                            attributes: ['id', 'email']
                        }
                    ]
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

        // Send WhatsApp and email confirmation (async, don't wait for response)
        try {
            twilioService.sendBookingConfirmation(createdBooking)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp & Email confirmation sent to ${createdBooking.Member.full_name}`);
                        logger.info(`📱 WhatsApp: ${result.whatsapp.success ? '✅' : '❌'}, 📧 Email: ${result.email.success ? '✅' : '❌'}`);
                    } else {
                        logger.error(`❌ Failed to send confirmation to ${createdBooking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending confirmation to ${createdBooking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating confirmation:', error);
        }

        res.status(201).json({
            success: true,
            message: isReusedBooking ? 'Booking berhasil diaktifkan kembali' : 'Booking berhasil dibuat',
            data: {
                booking_id: createdBooking.id,
                status: createdBooking.status,
                is_waitlist: createdBooking.status === 'waiting_list',
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
                },
                {
                    model: Member,
                    include: [
                        {
                            model: require('../models').User,
                            attributes: ['id', 'email']
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
            cancelled_by: status === 'cancelled' ? 'admin' : null
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

        // Send WhatsApp notifications for status changes
        try {
            if (oldStatus === 'waiting_list' && status === 'signup') {
                // Get full booking data with member info for notification
                const fullBooking = await Booking.findByPk(id, {
                    include: [
                        {
                            model: Schedule,
                            include: [
                                {
                                    model: require('../models').Class
                                },
                                {
                                    model: require('../models').Trainer
                                }
                            ]
                        },
                        {
                            model: Member,
                            include: [
                                {
                                    model: require('../models').User,
                                    attributes: ['id', 'email']
                                }
                            ]
                        }
                    ]
                });

                if (fullBooking) {
                    twilioService.sendWaitlistPromotion(fullBooking)
                        .then(result => {
                            if (result.success) {
                                logger.info(`✅ Waitlist promotion WhatsApp & Email sent to ${fullBooking.Member.full_name}`);
                                logger.info(`📱 WhatsApp: ${result.whatsapp.success ? '✅' : '❌'}, 📧 Email: ${result.email.success ? '✅' : '❌'}`);
                            } else {
                                logger.error(`❌ Failed to send waitlist promotion to ${fullBooking.Member.full_name}: ${result.error}`);
                            }
                        })
                        .catch(error => {
                            logger.error(`❌ Error sending waitlist promotion to ${fullBooking.Member.full_name}:`, error);
                        });
                }
            } else if (status === 'cancelled') {
                // Get full booking data with member info for cancellation notification
                const fullBooking = await Booking.findByPk(id, {
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
                                    model: require('../models').User,
                                    attributes: ['id', 'email']
                                }
                            ]
                        }
                    ]
                });

                if (fullBooking) {
                    twilioService.sendBookingCancellation(fullBooking, notes || 'Booking dibatalkan oleh admin')
                        .then(result => {
                            if (result.success) {
                                logger.info(`✅ Booking cancellation WhatsApp & Email sent to ${fullBooking.Member.full_name}`);
                                logger.info(`📱 WhatsApp: ${result.whatsapp.success ? '✅' : '❌'}, 📧 Email: ${result.email.success ? '✅' : '❌'}`);
                            } else {
                                logger.error(`❌ Failed to send booking cancellation to ${fullBooking.Member.full_name}: ${result.error}`);
                            }
                        })
                        .catch(error => {
                            logger.error(`❌ Error sending booking cancellation to ${fullBooking.Member.full_name}:`, error);
                        });
                }
            }
        } catch (error) {
            logger.error('Error sending WhatsApp notifications for status change:', error);
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
                    model: Member,
                    include: [
                        {
                            model: require('../models').User,
                            attributes: ['id', 'email']
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

        // Cek cancel buffer time
        const scheduleDateTime = new Date(`${booking.Schedule.date_start}T${booking.Schedule.time_start}`);
        const currentDateTime = new Date();
        const cancelBufferMinutes = booking.Schedule.cancel_buffer_minutes ?? 120; // Default 2 jam jika null/undefined
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
            cancelled_by: 'user' // User yang melakukan cancel
        });

        console.log(`🔄 Booking ${booking.id} status updated to: ${booking.status}`);

        // Send WhatsApp and email cancellation notification (async)
        try {
            twilioService.sendBookingCancellation(booking, cancelReason)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp & Email cancellation sent to ${booking.Member.full_name}`);
                        logger.info(`📱 WhatsApp: ${result.whatsapp.success ? '✅' : '❌'}, 📧 Email: ${result.email.success ? '✅' : '❌'}`);
                    } else {
                        logger.error(`❌ Failed to send cancellation to ${booking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending cancellation to ${booking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating cancellation:', error);
        }

        // PERBAIKAN: Update session usage setelah cancel untuk mengembalikan quota
        try {
            // Refresh booking data untuk memastikan status terbaru
            await booking.reload();
            
            // Extract member_package_id dari notes
            let memberPackageId = null;
            if (booking.notes && booking.notes.includes('MemberPackageID:')) {
                const match = booking.notes.match(/MemberPackageID: ([a-f0-9-]+)/);
                if (match) {
                    memberPackageId = match[1];
                }
            }
            
            // Gunakan member_package_id dari notes jika ada, jika tidak gunakan package_id
            let targetMemberPackage = null;
            if (memberPackageId) {
                targetMemberPackage = await require('../models').MemberPackage.findOne({
                    where: {
                        id: memberPackageId
                    }
                });
            }
            
            // Fallback: cari berdasarkan package_id jika member_package_id tidak ditemukan
            if (!targetMemberPackage) {
                targetMemberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id: booking.member_id,
                    package_id: booking.package_id
                }
            });
            }
            
            if (targetMemberPackage) {
                await updateSessionUsage(targetMemberPackage.id, booking.member_id, targetMemberPackage.package_id);
            }
        } catch (error) {
            console.error(`❌ Failed to update session usage after cancel: ${error.message}`);
        }

        // Process waitlist promotion untuk SEMUA cancel booking (tidak peduli status)
        let promotionResult = null;
        try {
            // Cek dulu apakah ada member di waitlist
            const waitlistCount = await Booking.count({
                where: {
                    schedule_id: booking.schedule_id,
                    status: 'waiting_list'
                }
            });
            
            logger.info(`📊 Waitlist check for schedule ${booking.schedule_id}: ${waitlistCount} members in waitlist`);
            
            if (waitlistCount > 0) {
                promotionResult = await processWaitlistPromotion(booking.schedule_id);
                if (promotionResult) {
                    logger.info(`✅ Waitlist promotion successful for schedule ${booking.schedule_id}. Promoted: ${promotionResult.Member?.full_name}`);
                } else {
                    logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id} (promotion failed)`);
                }
            } else {
                logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id} (waitlist empty)`);
                }
            } catch (error) {
                logger.error(`❌ Failed to process waitlist promotion: ${error.message}`);
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
            cancelled_by: 'admin' // Admin yang melakukan cancel
        });

        console.log(`🔄 Booking ${booking.id} status updated to: ${booking.status}`);

        // Send WhatsApp and email cancellation notification (async)
        try {
            // Send WhatsApp
            const whatsappResult = await twilioService.sendAdminCancellation(
                booking.Member.phone_number,
                booking.Member.full_name,
                booking.Schedule.Class.class_name,
                booking.Schedule.date_start,
                booking.Schedule.time_start,
                cancelReason
            );
            
            // Send email
            const memberEmail = booking.Member.User?.email || booking.Member.email;
            let emailResult = { success: false, error: 'No email available' };
            
            if (memberEmail) {
                emailResult = await emailService.sendAdminCancellationEmail(
                    booking.Member.full_name,
                    memberEmail,
                    booking.Schedule.Class.class_name,
                    booking.Schedule.date_start,
                    booking.Schedule.time_start,
                    cancelReason
                );
            }
            
            if (whatsappResult.success) {
                logger.info(`✅ Admin cancellation WhatsApp & Email sent to ${booking.Member.full_name}`);
                logger.info(`📱 WhatsApp: ${whatsappResult.success ? '✅' : '❌'}, 📧 Email: ${emailResult.success ? '✅' : '❌'}`);
                } else {
                logger.error(`❌ Failed to send admin cancellation to ${booking.Member.full_name}: ${whatsappResult.error}`);
                }
        } catch (error) {
            logger.error('Error initiating admin cancellation:', error);
        }

        // PERBAIKAN: Update session usage setelah admin cancel untuk mengembalikan quota
        try {
            // Refresh booking data untuk memastikan status terbaru
            await booking.reload();
            
            // Extract member_package_id dari notes
            let memberPackageId = null;
            if (booking.notes && booking.notes.includes('MemberPackageID:')) {
                const match = booking.notes.match(/MemberPackageID: ([a-f0-9-]+)/);
                if (match) {
                    memberPackageId = match[1];
                }
            }
            
            // Gunakan member_package_id dari notes jika ada, jika tidak gunakan package_id
            let targetMemberPackage = null;
            if (memberPackageId) {
                targetMemberPackage = await require('../models').MemberPackage.findOne({
                    where: {
                        id: memberPackageId
                    }
                });
            }
            
            // Fallback: cari berdasarkan package_id jika member_package_id tidak ditemukan
            if (!targetMemberPackage) {
                targetMemberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id: booking.member_id,
                    package_id: booking.package_id
                }
            });
            }
            
            if (targetMemberPackage) {
                await updateSessionUsage(targetMemberPackage.id, booking.member_id, targetMemberPackage.package_id);
            }
        } catch (error) {
            console.error(`❌ Failed to update session usage after admin cancel: ${error.message}`);
        }

        // Process waitlist promotion untuk SEMUA cancel booking (tidak peduli status)
        let promotionResult = null;
        try {
            // Cek dulu apakah ada member di waitlist
            const waitlistCount = await Booking.count({
                where: {
                    schedule_id: booking.schedule_id,
                    status: 'waiting_list'
                }
            });
            
            logger.info(`📊 Waitlist check for schedule ${booking.schedule_id}: ${waitlistCount} members in waitlist`);
            
            if (waitlistCount > 0) {
                promotionResult = await processWaitlistPromotion(booking.schedule_id);
                if (promotionResult) {
                    logger.info(`✅ Waitlist promotion successful for schedule ${booking.schedule_id}. Promoted: ${promotionResult.Member?.full_name}`);
                } else {
                    logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id} (promotion failed)`);
                }
            } else {
                logger.info(`ℹ️ No waitlist members to promote for schedule ${booking.schedule_id} (waitlist empty)`);
                }
            } catch (error) {
                logger.error(`❌ Failed to process waitlist promotion: ${error.message}`);
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
                cancelled_by: 'admin',
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

        // Send WhatsApp notification for absent/late attendance
        if (attendance === 'absent' || attendance === 'late') {
            try {
                twilioService.sendAttendanceNotification(
                    booking.Member.phone_number,
                    booking.Member.full_name,
                    booking.Schedule.Class.class_name,
                    booking.Schedule.date_start,
                    booking.Schedule.time_start,
                    attendance
                ).then(result => {
                    if (result.success) {
                        logger.info(`✅ Attendance notification WhatsApp sent to ${booking.Member.full_name}`);
                    } else {
                        logger.error(`❌ Failed to send attendance notification WhatsApp to ${booking.Member.full_name}: ${result.error}`);
                    }
                }).catch(error => {
                    logger.error(`❌ Error sending attendance notification WhatsApp to ${booking.Member.full_name}:`, error);
                });
            } catch (error) {
                logger.error('Error initiating attendance notification WhatsApp:', error);
            }
        }

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
            const oldAttendance = booking.attendance;
            
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

                // Send WhatsApp notification for absent/late attendance
                if (attendanceData.attendance === 'absent' || attendanceData.attendance === 'late') {
                    try {
                        twilioService.sendAttendanceNotification(
                            booking.Member.phone_number,
                            booking.Member.full_name,
                            schedule.Class.class_name,
                            schedule.date_start,
                            schedule.time_start,
                            attendanceData.attendance
                        ).then(result => {
                            if (result.success) {
                                logger.info(`✅ Schedule attendance notification WhatsApp sent to ${booking.Member.full_name}`);
                            } else {
                                logger.error(`❌ Failed to send schedule attendance notification WhatsApp to ${booking.Member.full_name}: ${result.error}`);
                            }
                        }).catch(error => {
                            logger.error(`❌ Error sending schedule attendance notification WhatsApp to ${booking.Member.full_name}:`, error);
                        });
                    } catch (error) {
                        logger.error('Error initiating schedule attendance notification WhatsApp:', error);
                    }
                }
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