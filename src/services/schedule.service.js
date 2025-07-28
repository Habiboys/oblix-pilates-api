const { Schedule, Class, Trainer, Member, Booking } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

/**
 * Shared service untuk schedule operations
 */
class ScheduleService {
    /**
     * Get kapasitas maksimal berdasarkan tipe schedule
     */
    static getMaxCapacity(type) {
        switch (type) {
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
        const maxCapacity = this.getMaxCapacity(schedule.type);
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
     * Format schedule data dengan informasi lengkap
     */
    static formatScheduleData(schedule, includeBookings = false) {
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
                    scheduleData.signup_bookings = signupBookings.map(b => ({
            id: b.id,
            member_id: b.Member.id,
            member_name: b.Member.full_name,
            member_phone: b.Member.phone_number,
            member_email: b.Member.User?.email || '',
            status: b.status,
            attendance: b.attendance,
            notes: b.notes,
            created_at: b.createdAt
        }));
                    scheduleData.waitlist_bookings = waitlistBookings.map(b => ({
            id: b.id,
            member_id: b.Member.id,
            member_name: b.Member.full_name,
            member_phone: b.Member.phone_number,
            member_email: b.Member.User?.email || '',
            status: b.status,
            attendance: b.attendance,
            notes: b.notes,
            created_at: b.createdAt
        }));
                    scheduleData.cancelled_bookings = cancelledBookings.map(b => ({
            id: b.id,
            member_id: b.Member.id,
            member_name: b.Member.full_name,
            member_phone: b.Member.phone_number,
            member_email: b.Member.User?.email || '',
            status: b.status,
            attendance: b.attendance,
            notes: b.notes,
            created_at: b.createdAt
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

        // Tambahkan assigned member untuk private schedule
        if (type === 'private') {
            includes.push({
                model: Member,
                as: 'assignedMember',
                attributes: ['id', 'full_name', 'phone_number'],
                include: [
                    {
                        model: require('../models').User,
                        attributes: ['email']
                    }
                ]
            });
        }

        // Tambahkan booking associations
        const bookingStatuses = type === 'private' ? ['signup', 'cancelled'] : ['signup', 'waiting_list', 'cancelled'];
        includes.push({
            model: Booking,
            where: {
                status: {
                    [Op.in]: bookingStatuses
                }
            },
            required: false,
            include: includeBookings ? [
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
            ] : []
        });

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