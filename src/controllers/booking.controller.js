const { Booking, Schedule, Member, Package, MemberPackage, Class, Trainer, User } = require('../models');
const { Op } = require('sequelize');
const { validateSessionAvailability, createSessionAllocation, getMemberSessionSummary, getBestPackageForBooking, setPackageStartDate } = require('../utils/sessionTrackingUtils');
const { autoCancelExpiredBookings, processWaitlistPromotion } = require('../utils/bookingUtils');
const { validateMemberScheduleConflict } = require('../utils/scheduleUtils');
const { updateSessionUsage } = require('../utils/sessionTrackingUtils');
const whatsappService = require('../services/whatsapp.service');

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
            logger.info(`🔍 Using selected member package: memberPackageId=${selectedMemberPackageId}`);

            if (selectedMemberPackageId) {
                logger.info(`🔄 Updating session usage for member package ${selectedMemberPackageId}`);
                const updateResult = await updateSessionUsage(selectedMemberPackageId, member_id, selectedPackageId, booking.id);
                logger.info(`✅ Session usage updated successfully:`, updateResult);

                // PERBAIKAN: Set start_date dan end_date saat booking berhasil (status = 'signup')
                if (booking.status === 'signup') {
                    try {
                        logger.info(`📅 Setting start_date for successful booking: member_id=${member_id}, package_id=${selectedPackageId}, memberPackageId=${selectedMemberPackageId}`);
                        const dateResult = await setPackageStartDate(member_id, selectedPackageId, selectedMemberPackageId);
                        logger.info(`✅ Start date set successfully:`, dateResult);
                    } catch (dateError) {
                        logger.error(`❌ Failed to set start_date: ${dateError.message}`);
                    }
                } else {
                    logger.info(`⏳ Booking status is '${booking.status}', start_date will be set when booking becomes 'signup'`);
                }
            } else {
                logger.error(`❌ Selected member package ID not found for member_id=${member_id}, package_id=${selectedPackageId}`);
            }
        } catch (error) {
            logger.error(`❌ Failed to update session usage: ${error.message}`);
            logger.error(`❌ Error stack: ${error.stack}`);
        }

        // Send WhatsApp and email confirmation (async, don't wait for response)
        try {
            whatsappService.sendBookingConfirmation(createdBooking)
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

// Create booking for admin (menambahkan member ke schedule)
const createAdminBooking = async (req, res) => {
    try {
        const { schedule_id, member_ids, notes, guests } = req.body;

        // Validasi input
        const hasMembers = member_ids && Array.isArray(member_ids) && member_ids.length > 0;
        const hasGuests = guests && Array.isArray(guests) && guests.length > 0;

        if (!schedule_id || (!hasMembers && !hasGuests)) {
            return res.status(400).json({
                success: false,
                message: 'schedule_id dan minimal satu member atau guest harus diisi'
            });
        }

        // Initialize arrays if undefined
        const membersList = hasMembers ? member_ids : [];
        const guestsList = hasGuests ? guests : [];

        // Cek apakah schedule exists
        const schedule = await Schedule.findByPk(schedule_id);
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule tidak ditemukan'
            });
        }

        // Cek apakah semua member exists
        // Cek apakah semua member exists
        let members = [];
        if (membersList.length > 0) {
            members = await Member.findAll({
                where: { id: membersList }
            });

            if (members.length !== membersList.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Beberapa member tidak ditemukan'
                });
            }
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

        // Cek kapasitas schedule dan existing bookings
        const currentSignups = await Booking.count({
            where: {
                schedule_id: schedule_id,
                status: 'signup'
            }
        });

        const maxCapacity = schedule.pax || 20;
        const availableSlots = maxCapacity - currentSignups;
        const totalToAdd = membersList.length + guestsList.length;

        if (totalToAdd > availableSlots) {
            return res.status(400).json({
                success: false,
                message: `Schedule hanya memiliki ${availableSlots} slot tersisa, tidak cukup untuk ${totalToAdd} orang (${membersList.length} member + ${guestsList.length} guest)`
            });
        }

        // Cek existing bookings untuk semua member (hanya yang aktif, bukan cancelled)
        if (membersList.length > 0) {
            const existingBookings = await Booking.findAll({
                where: {
                    schedule_id,
                    member_id: membersList,
                    status: {
                        [Op.notIn]: ['cancelled']
                    }
                }
            });

            if (existingBookings.length > 0) {
                const existingMemberIds = existingBookings.map(b => b.member_id);
                const existingMemberNames = members
                    .filter(m => existingMemberIds.includes(m.id))
                    .map(m => m.full_name);

                return res.status(400).json({
                    success: false,
                    message: `Beberapa member sudah terdaftar di schedule ini: ${existingMemberNames.join(', ')}`
                });
            }

            // Cek booking yang sudah di-cancel untuk diaktifkan kembali
        }

        // Cek booking yang sudah di-cancel untuk diaktifkan kembali (only for members)
        let cancelledBookings = [];
        if (membersList.length > 0) {
            cancelledBookings = await Booking.findAll({
                where: {
                    schedule_id,
                    member_id: membersList,
                    status: 'cancelled'
                }
            });
        }

        const membersToReuse = [];
        const membersToCreate = [];

        for (const member of members) {
            const cancelledBooking = cancelledBookings.find(b => b.member_id === member.id);
            if (cancelledBooking) {
                membersToReuse.push({ member, cancelledBooking });
            } else {
                membersToCreate.push(member);
            }
        }

        // Cek jadwal bentrok untuk semua member
        const membersWithConflicts = [];
        for (const member of members) {
            try {
                const memberConflict = await validateMemberScheduleConflict(
                    member.id,
                    schedule.date_start,
                    schedule.time_start,
                    schedule.time_end
                );

                if (memberConflict.hasConflict) {
                    membersWithConflicts.push({
                        member_name: member.full_name,
                        conflicts: memberConflict.conflicts
                    });
                }
            } catch (error) {
                logger.error(`Error checking schedule conflict for member ${member.full_name}:`, error);
                // Jika ada error validasi, anggap ada conflict untuk safety
                membersWithConflicts.push({
                    member_name: member.full_name,
                    conflicts: [{ message: 'Error checking schedule conflict' }]
                });
            }
        }

        if (membersWithConflicts.length > 0) {
            const conflictDetails = membersWithConflicts.map(m =>
                `${m.member_name}: ${m.conflicts.map(c => c.message).join(', ')}`
            ).join('; ');

            return res.status(400).json({
                success: false,
                message: 'Beberapa member memiliki jadwal yang bentrok',
                data: {
                    members_with_conflicts: membersWithConflicts,
                    conflict_summary: conflictDetails
                }
            });
        }

        // Buat multiple bookings untuk semua member
        const adminNotes = notes ? `${notes} (Ditambahkan oleh admin)` : 'Ditambahkan oleh admin';
        const bookings = [];

        // Aktifkan kembali booking yang sudah di-cancel
        for (const { member, cancelledBooking } of membersToReuse) {
            try {
                // Update booking yang sudah di-cancel menjadi signup
                await cancelledBooking.update({
                    status: 'signup',
                    notes: adminNotes,
                    cancelled_by: null // Reset cancelled_by karena sekarang aktif lagi
                });

                // Cari MemberPackage yang sesuai
                const memberPackage = await MemberPackage.findOne({
                    where: {
                        member_id: member.id,
                        package_id: cancelledBooking.package_id
                    }
                });

                if (memberPackage) {
                    // Update session usage untuk mengembalikan quota yang sudah dikembalikan saat cancel
                    await updateSessionUsage(memberPackage.id, member.id, cancelledBooking.package_id);
                }

                bookings.push({
                    booking_id: cancelledBooking.id,
                    member_name: member.full_name,
                    package_name: 'Reused from cancelled booking',
                    package_type: 'reused',
                    action: 'reactivated'
                });

                logger.info(`✅ Reactivated cancelled booking for ${member.full_name}`);
            } catch (error) {
                logger.error(`❌ Failed to reactivate booking for ${member.full_name}: ${error.message}`);
            }
        }

        // Buat booking baru untuk member yang belum pernah booking
        for (const member of membersToCreate) {
            // Cari package yang tersedia untuk member ini
            let bestPackage = null;

            // Tentukan scheduleType seperti di user booking
            let scheduleType = 'group';
            if (schedule.type === 'private') {
                scheduleType = 'private';
            } else if (schedule.type === 'semi_private') {
                scheduleType = 'semi_private';
            }

            // Debug: Cek MemberPackage yang dimiliki member (simplified)
            const memberPackages = await MemberPackage.findAll({
                where: { member_id: member.id },
                include: [
                    {
                        model: Package,
                        attributes: ['id', 'name', 'type']
                    }
                ]
            });

            logger.info(`🔍 Debug ${member.full_name}: Found ${memberPackages.length} member packages`);
            memberPackages.forEach((mp, idx) => {
                logger.info(`  Package ${idx + 1}: ${mp.Package?.name} (${mp.Package?.type})`);
                logger.info(`    Group: ${mp.remaining_group_session}/${mp.used_group_session}`);
                logger.info(`    Private: ${mp.remaining_private_session}/${mp.used_private_session}`);
                logger.info(`    Semi-Private: ${mp.remaining_semi_private_session}/${mp.used_semi_private_session}`);
                logger.info(`    End Date: ${mp.end_date}, Active: ${mp.end_date ? (new Date(mp.end_date) >= new Date() ? 'Yes' : 'No') : 'No end date'}`);
            });

            try {
                bestPackage = await getBestPackageForBooking(member.id, scheduleType);
                logger.info(`✅ ${member.full_name}: Found best package: ${bestPackage.package_name}`);
            } catch (error) {
                logger.warn(`❌ ${member.full_name} tidak memiliki package yang tersedia untuk ${scheduleType} class: ${error.message}`);
                continue; // Skip member ini, lanjut ke member berikutnya
            }

            if (bestPackage) {
                // Buat booking
                const booking = await Booking.create({
                    schedule_id,
                    member_id: member.id,
                    package_id: bestPackage.package_id,
                    status: 'signup',
                    notes: adminNotes
                });

                // Cari MemberPackage yang sesuai
                const memberPackage = await MemberPackage.findOne({
                    where: {
                        member_id: member.id,
                        package_id: bestPackage.package_id
                    }
                });

                if (memberPackage) {
                    // Update session usage
                    await updateSessionUsage(memberPackage.id, member.id, bestPackage.package_id);
                } else {
                    logger.warn(`MemberPackage not found for member ${member.full_name} and package ${bestPackage.package_name}`);
                }

                // Set package start date jika belum ada
                if (memberPackage) {
                    await setPackageStartDate(member.id, bestPackage.package_id, memberPackage.id);
                } else {
                    logger.warn(`Cannot set package start date for ${member.full_name}: MemberPackage not found`);
                }

                bookings.push({
                    booking_id: booking.id,
                    member_name: member.full_name,
                    package_name: bestPackage.package_name,
                    package_type: bestPackage.package_type
                });
            }
        }

        // Buat booking untuk guests
        for (const guestName of guestsList) {
            try {
                const booking = await Booking.create({
                    schedule_id,
                    member_id: null,
                    guest_name: guestName,
                    status: 'signup',
                    notes: notes ? `${notes} (Guest added by admin)` : 'Guest added by admin'
                });

                bookings.push({
                    booking_id: booking.id,
                    member_name: guestName,
                    is_guest: true,
                    package_name: 'Guest (No Package)',
                    package_type: 'guest'
                });

                logger.info(`🆕 Created guest booking ${booking.id} for ${guestName}`);
            } catch (error) {
                logger.error(`❌ Failed to create booking for guest ${guestName}: ${error.message}`);
            }
        }

        if (bookings.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Tidak ada member yang berhasil ditambahkan karena tidak memiliki package yang tersedia untuk ${schedule.type} class`,
                data: {
                    schedule_type: schedule.type,
                    total_members_checked: members.length,
                    members_without_packages: members.map(m => m.full_name)
                }
            });
        }

        // Kirim notifikasi WhatsApp untuk semua member yang berhasil ditambahkan
        for (const booking of bookings) {
            const member = members.find(m => m.full_name === booking.member_name);
            if (member) {
                try {
                    // Untuk booking yang di-reactivate, kita perlu fetch booking data yang lengkap
                    let fullBookingData;
                    if (booking.action === 'reactivated') {
                        fullBookingData = await Booking.findByPk(booking.booking_id, {
                            include: [
                                {
                                    model: Schedule,
                                    include: [
                                        {
                                            model: Class
                                        },
                                        {
                                            model: Trainer
                                        }
                                    ]
                                },
                                {
                                    model: Member,
                                    include: [
                                        {
                                            model: User
                                        }
                                    ]
                                }
                            ]
                        });
                    } else {
                        // Untuk booking baru, gunakan data yang sudah ada
                        fullBookingData = await Booking.findByPk(booking.booking_id, {
                            include: [
                                {
                                    model: Schedule,
                                    include: [
                                        {
                                            model: Class
                                        },
                                        {
                                            model: Trainer
                                        }
                                    ]
                                },
                                {
                                    model: Member,
                                    include: [
                                        {
                                            model: User
                                        }
                                    ]
                                }
                            ]
                        });
                    }

                    if (fullBookingData && fullBookingData.Schedule && fullBookingData.Schedule.Class) {
                        try {
                            await whatsappService.sendBookingConfirmation(fullBookingData);
                        } catch (whatsappError) {
                            logger.warn(`WhatsApp notification failed for ${member.full_name}:`, whatsappError.message);
                        }
                    } else {
                        logger.warn(`Cannot send WhatsApp notification for ${member.full_name}: Missing booking data`);
                    }
                } catch (whatsappError) {
                    logger.warn(`Failed to send WhatsApp notification to ${member.full_name}:`, whatsappError);
                }
            }
        }

        const reactivatedCount = bookings.filter(b => b.action === 'reactivated').length;
        const newBookingsCount = bookings.filter(b => !b.action).length;

        res.status(201).json({
            success: true,
            message: `${bookings.length} member berhasil ditambahkan ke schedule oleh admin`,
            data: {
                schedule_id: schedule_id,
                schedule_date: schedule.date_start,
                schedule_time: `${schedule.time_start} - ${schedule.time_end}`,
                total_members_added: bookings.length,
                reactivated_bookings: reactivatedCount,
                new_bookings: newBookingsCount,
                notes: adminNotes,
                bookings: bookings
            }
        });

    } catch (error) {
        logger.error('Error creating admin booking:', error);
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
                const memberPackage = await MemberPackage.findOne({
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
                    whatsappService.sendWaitlistPromotion(fullBooking)
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
                    whatsappService.sendBookingCancellation(fullBooking, notes || 'Booking dibatalkan oleh admin')
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

        logger.info(`🔧 USER CANCEL BOOKING called for booking ID: ${id}`);
        logger.info(`🔧 User ID: ${req.user.id}, Role: ${req.user.role}`);

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

        logger.info(`✅ USER CANCEL: Booking ${booking.id} status updated to: ${booking.status}, cancelled_by: user`);
        console.log(`🔄 Booking ${booking.id} status updated to: ${booking.status}`);

        // Send WhatsApp and email cancellation notification (async)
        try {
            whatsappService.sendBookingCancellation(booking, cancelReason)
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

        logger.info(`🔧 ADMIN CANCEL BOOKING called for booking ID: ${id}`);
        logger.info(`🔧 Admin user ID: ${req.user.id}, Role: ${req.user.role}`);

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

        logger.info(`✅ ADMIN CANCEL: Booking ${booking.id} status updated to: ${booking.status}, cancelled_by: admin`);
        console.log(`🔄 Booking ${booking.id} status updated to: ${booking.status}`);

        // Send WhatsApp and email cancellation notification (async)
        try {
            // Send WhatsApp
            const whatsappResult = await whatsappService.sendAdminCancellation(
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

        const responseData = {
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
        };

        logger.info(`✅ ADMIN CANCEL RESPONSE: cancelled_by = ${responseData.data.cancelled_by}`);
        res.json(responseData);
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
                whatsappService.sendAttendanceNotification(
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
                        whatsappService.sendAttendanceNotification(
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
    adminCancelBooking,
    createAdminBooking
}; 