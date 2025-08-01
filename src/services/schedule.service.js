const { Schedule, Class, Trainer, Member, Booking, Package, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getMemberSessionSummary } = require('../utils/sessionTrackingUtils');

/**
 * Shared service untuk schedule operations
 */
class ScheduleService {
    /**
     * Get kapasitas maksimal berdasarkan tipe schedule
     */
    static getMaxCapacity(schedule) {
        // Gunakan field pax dari schedule, fallback ke default berdasarkan type
        if (schedule.pax) {
            return schedule.pax;
        }
        
        // Fallback ke default jika pax tidak ada
        switch (schedule.type) {
            case 'group':
                return 20;
            case 'semi_private':
                return 4;
            case 'private':
                return 1;
            default:
                return 20;
        }
    }

    /**
     * Get minimum signup berdasarkan tipe schedule
     */
    static getMinSignup(type, customMinSignup = null) {
        if (customMinSignup) return customMinSignup;
        
        switch (type) {
            case 'group':
                return 5;
            case 'semi_private':
                return 2;
            case 'private':
                return 1;
            default:
                return 5;
        }
    }

    /**
     * Hitung status kelas berdasarkan booking
     */
    static calculateScheduleStatus(schedule, signupBookings, waitlistBookings) {
        const maxCapacity = this.getMaxCapacity(schedule);
        const minSignup = this.getMinSignup(schedule.type, schedule.min_signup);
        const availableSlots = Math.max(0, maxCapacity - signupBookings.length);
        const isFull = availableSlots === 0;
        const hasWaitlist = waitlistBookings.length > 0;
        
        let status = 'available';
        if (isFull && hasWaitlist) {
            status = 'full_with_waitlist';
        } else if (isFull) {
            status = 'full';
        } else if (signupBookings.length < minSignup) {
            status = 'minimum_not_met';
        }
        
        return {
            status,
            isFull,
            hasWaitlist,
            availableSlots,
            maxCapacity,
            minSignup
        };
    }

    /**
     * Cek apakah sudah melewati cancel buffer time
     */
    static checkCancelBufferTime(schedule) {
        const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const currentDateTime = new Date();
        const cancelBufferMinutes = schedule.cancel_buffer_minutes || 120;
        const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));
        const isPastCancelDeadline = currentDateTime > cancelDeadline;
        
        return {
            isPastCancelDeadline,
            cancelBufferMinutes,
            cancelDeadline,
            scheduleDateTime
        };
    }

    /**
     * Get session left info untuk member
     */
    static async getMemberSessionInfo(memberId, packageId) {
        try {
            const { MemberPackage } = require('../models');
            const memberPackage = await MemberPackage.findOne({
                where: {
                    member_id: memberId,
                    package_id: packageId
                }
            });

            if (!memberPackage) {
                return null;
            }

            return {
                private_sessions_left: memberPackage.private_sessions_left || 0,
                semi_private_sessions_left: memberPackage.semi_private_sessions_left || 0,
                group_sessions_left: memberPackage.group_sessions_left || 0,
                total_sessions_left: (memberPackage.private_sessions_left || 0) + 
                                   (memberPackage.semi_private_sessions_left || 0) + 
                                   (memberPackage.group_sessions_left || 0)
            };
        } catch (error) {
            logger.error('Error getting member session info:', error);
            return null;
        }
    }

    /**
     * Format schedule data dengan informasi lengkap
     */
    static async formatScheduleData(schedule, includeBookings = false) {
        // Hitung booking berdasarkan status
        const signupBookings = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'signup') : [];
        const waitlistBookings = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'waiting_list') : [];
        const cancelledBookings = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'cancelled') : [];
        
        // Hitung status dan kapasitas
        const statusInfo = this.calculateScheduleStatus(schedule, signupBookings, waitlistBookings);
        const cancelInfo = this.checkCancelBufferTime(schedule);
        
        const scheduleData = {
            id: schedule.id,
            class_name: schedule.Class?.class_name || '',
            class_color: schedule.Class?.color_sign || '#000000',
            trainer_name: schedule.Trainer?.title || '',
            trainer_picture: schedule.Trainer?.picture || '',
            trainer_description: schedule.Trainer?.description || '',
            type: schedule.type,
            date_start: schedule.date_start,
            time_start: schedule.time_start,
            time_end: schedule.time_end,
            
            // Informasi booking dan slot
            max_capacity: statusInfo.maxCapacity,
            current_signups: signupBookings.length,
            waitlist_count: waitlistBookings.length,
            cancelled_count: cancelledBookings.length,
            available_slots: statusInfo.availableSlots,
            min_signup: statusInfo.minSignup,
            
            // Status dan kondisi
            status: statusInfo.status,
            is_full: statusInfo.isFull,
            has_waitlist: statusInfo.hasWaitlist,
            is_past_cancel_deadline: cancelInfo.isPastCancelDeadline,
            can_book: !cancelInfo.isPastCancelDeadline && (statusInfo.availableSlots > 0 || statusInfo.hasWaitlist),
            can_cancel: !cancelInfo.isPastCancelDeadline,
            
            // Informasi tambahan
            cancel_buffer_minutes: cancelInfo.cancelBufferMinutes,
            repeat_type: schedule.repeat_type || 'none',
            schedule_until: schedule.schedule_until,
            parent_schedule_id: schedule.parent_schedule_id,
            
            // Metadata
            created_at: schedule.createdAt,
            updated_at: schedule.updatedAt
        };
        
        // Tambahkan informasi khusus berdasarkan tipe
        if (schedule.type === 'group') {
            scheduleData.booking_deadline_hour = schedule.booking_deadline_hour || 24;
            scheduleData.waitlist_lock_minutes = schedule.waitlist_lock_minutes || 30;
        }
        
        if (schedule.type === 'private' && schedule.assignedMember) {
            scheduleData.assigned_member = {
                id: schedule.assignedMember.id,
                name: schedule.assignedMember.full_name,
                email: schedule.assignedMember.User?.email || '',
                phone: schedule.assignedMember.phone_number
            };
        }
        
        // Tambahkan detail booking jika diminta
        if (includeBookings && schedule.Bookings) {
            // Get session summary for each member
            const bookingPromises = schedule.Bookings.map(async (b) => {
                let sessionSummary = null;
                try {
                    sessionSummary = await getMemberSessionSummary(b.member_id);
                } catch (error) {
                    logger.error(`Error getting session summary for member ${b.member_id}:`, error);
                }
                return { booking: b, sessionSummary };
            });

            const bookingsWithSessions = await Promise.all(bookingPromises);

            scheduleData.signup_bookings = bookingsWithSessions
                .filter(item => item.booking.status === 'signup')
                .map(item => ({
                    id: item.booking.id,
                    member_id: item.booking.Member.id,
                    member_name: item.booking.Member.full_name,
                    member_phone: item.booking.Member.phone_number,
                    member_email: item.booking.Member.User?.email || '',
                    status: item.booking.status,
                    attendance: item.booking.attendance,
                    notes: item.booking.notes,
                    created_at: item.booking.createdAt,
                    // Tambahkan session left info
                    session_left: item.sessionSummary ? {
                        total_available_sessions: item.sessionSummary.total_available_sessions,
                        packages: item.sessionSummary.packages
                    } : null,
                    package_info: item.booking.Package ? {
                        package_name: item.booking.Package.name,
                        package_type: item.booking.Package.type
                    } : null
                }));
            
            scheduleData.waitlist_bookings = bookingsWithSessions
                .filter(item => item.booking.status === 'waiting_list')
                .map(item => ({
                    id: item.booking.id,
                    member_id: item.booking.Member.id,
                    member_name: item.booking.Member.full_name,
                    member_phone: item.booking.Member.phone_number,
                    member_email: item.booking.Member.User?.email || '',
                    status: item.booking.status,
                    attendance: item.booking.attendance,
                    notes: item.booking.notes,
                    created_at: item.booking.createdAt,
                    // Tambahkan session left info
                    session_left: item.sessionSummary ? {
                        total_available_sessions: item.sessionSummary.total_available_sessions,
                        packages: item.sessionSummary.packages
                    } : null,
                    package_info: item.booking.Package ? {
                        package_name: item.booking.Package.name,
                        package_type: item.booking.Package.type
                    } : null
                }));
            
            scheduleData.cancelled_bookings = bookingsWithSessions
                .filter(item => item.booking.status === 'cancelled')
                .map(item => ({
                    id: item.booking.id,
                    member_id: item.booking.Member.id,
                    member_name: item.booking.Member.full_name,
                    member_phone: item.booking.Member.phone_number,
                    member_email: item.booking.Member.User?.email || '',
                    status: item.booking.status,
                    attendance: item.booking.attendance,
                    notes: item.booking.notes,
                    created_at: item.booking.createdAt,
                    cancelled_at: item.booking.updatedAt,
                    cancelled_by: item.booking.cancelled_by,
                    // Tambahkan session left info
                    session_left: item.sessionSummary ? {
                        total_available_sessions: item.sessionSummary.total_available_sessions,
                        packages: item.sessionSummary.packages
                    } : null,
                    package_info: item.booking.Package ? {
                        package_name: item.booking.Package.name,
                        package_type: item.booking.Package.type
                    } : null
                }));
        }
        
        return scheduleData;
    }

    /**
     * Get include associations berdasarkan tipe schedule
     */
    static getIncludeAssociations(type, includeBookings = false) {
        const includes = [
            {
                model: Class,
                attributes: ['id', 'class_name', 'color_sign']
            },
            {
                model: Trainer,
                attributes: ['id', 'title', 'picture']
            }
        ];

        // Add assigned member for private schedules
        if (type === 'private') {
            includes.push({
                model: Member,
                as: 'assignedMember',
                attributes: ['id', 'full_name', 'phone_number'],
                include: [
                    {
                        model: User,
                        attributes: ['email']
                    }
                ]
            });
        }

        // Add bookings if requested
        if (includeBookings) {
            includes.push({
                model: Booking,
                attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt', 'cancelled_by'],
                include: [
                    {
                        model: Member,
                        attributes: ['id', 'full_name', 'phone_number'],
                        include: [
                            {
                                model: User,
                                attributes: ['email']
                            }
                        ]
                    },
                    {
                        model: Package,
                        attributes: ['id', 'name', 'type']
                    }
                ]
            });
        }

        return includes;
    }

    /**
     * Build where clause untuk filter
     */
    static buildWhereClause(type, filters = {}) {
        const whereClause = { type };

        // Add search filter
        if (filters.search) {
            whereClause['$Class.class_name$'] = { [Op.like]: `%${filters.search}%` };
        }

        // Add date filter
        if (filters.date) {
            whereClause.date_start = filters.date;
        }

        return whereClause;
    }
}

module.exports = ScheduleService; 