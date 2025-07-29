const { Schedule, Booking, Member } = require('../models');
const { Op } = require('sequelize');

/**
 * Validasi konflik jadwal trainer
 * @param {string} trainerId - ID trainer
 * @param {string} dateStart - Tanggal mulai (YYYY-MM-DD)
 * @param {string} timeStart - Waktu mulai (HH:MM:SS)
 * @param {string} timeEnd - Waktu selesai (HH:MM:SS)
 * @param {string} excludeScheduleId - ID schedule yang di-exclude (untuk update)
 * @returns {Promise<Object>} Object berisi hasil validasi
 */
const validateTrainerScheduleConflict = async (trainerId, dateStart, timeStart, timeEnd, excludeScheduleId = null) => {
    try {
        const whereClause = {
            trainer_id: trainerId,
            date_start: dateStart
        };

        // Exclude schedule yang sedang diupdate
        if (excludeScheduleId) {
            whereClause.id = { [Op.ne]: excludeScheduleId };
        }

        const conflictingSchedules = await Schedule.findAll({
            where: whereClause
        });

        const conflicts = conflictingSchedules.filter(schedule => {
            // Cek apakah ada overlap waktu
            const existingStart = schedule.time_start;
            const existingEnd = schedule.time_end;
            
            // Konversi ke menit untuk memudahkan perbandingan
            const newStartMinutes = parseInt(timeStart.split(':')[0]) * 60 + parseInt(timeStart.split(':')[1]);
            const newEndMinutes = parseInt(timeEnd.split(':')[0]) * 60 + parseInt(timeEnd.split(':')[1]);
            const existingStartMinutes = parseInt(existingStart.split(':')[0]) * 60 + parseInt(existingStart.split(':')[1]);
            const existingEndMinutes = parseInt(existingEnd.split(':')[0]) * 60 + parseInt(existingEnd.split(':')[1]);
            
            // Cek overlap: (start1 < end2) && (start2 < end1)
            return (newStartMinutes < existingEndMinutes) && (existingStartMinutes < newEndMinutes);
        });

        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts.map(schedule => ({
                id: schedule.id,
                date_start: schedule.date_start,
                time_start: schedule.time_start,
                time_end: schedule.time_end,
                type: schedule.type,
                class_name: schedule.Class?.class_name || 'Unknown'
            }))
        };
    } catch (error) {
        console.error('Error validating trainer schedule conflict:', error);
        return {
            hasConflict: false,
            conflicts: [],
            error: error.message
        };
    }
};

/**
 * Validasi konflik jadwal member
 * @param {string} memberId - ID member
 * @param {string} dateStart - Tanggal mulai (YYYY-MM-DD)
 * @param {string} timeStart - Waktu mulai (HH:MM:SS)
 * @param {string} timeEnd - Waktu selesai (HH:MM:SS)
 * @param {string} excludeBookingId - ID booking yang di-exclude (untuk update)
 * @returns {Promise<Object>} Object berisi hasil validasi
 */
const validateMemberScheduleConflict = async (memberId, dateStart, timeStart, timeEnd, excludeBookingId = null) => {
    try {
        const whereClause = {
            member_id: memberId,
            status: { [Op.in]: ['signup', 'waiting_list'] } // Hanya booking yang aktif
        };

        // Exclude booking yang sedang diupdate
        if (excludeBookingId) {
            whereClause.id = { [Op.ne]: excludeBookingId };
        }

        const memberBookings = await Booking.findAll({
            where: whereClause,
            attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: dateStart
                    }
                }
            ]
        });

        const conflicts = memberBookings.filter(booking => {
            const schedule = booking.Schedule;
            if (!schedule) return false;

            // Cek apakah ada overlap waktu
            const existingStart = schedule.time_start;
            const existingEnd = schedule.time_end;
            
            // Konversi ke menit untuk memudahkan perbandingan
            const newStartMinutes = parseInt(timeStart.split(':')[0]) * 60 + parseInt(timeStart.split(':')[1]);
            const newEndMinutes = parseInt(timeEnd.split(':')[0]) * 60 + parseInt(timeEnd.split(':')[1]);
            const existingStartMinutes = parseInt(existingStart.split(':')[0]) * 60 + parseInt(existingStart.split(':')[1]);
            const existingEndMinutes = parseInt(existingEnd.split(':')[0]) * 60 + parseInt(existingEnd.split(':')[1]);
            
            // Cek overlap: (start1 < end2) && (start2 < end1)
            return (newStartMinutes < existingEndMinutes) && (existingStartMinutes < newEndMinutes);
        });

        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts.map(booking => ({
                id: booking.id,
                schedule_id: booking.schedule_id,
                date_start: booking.Schedule.date_start,
                time_start: booking.Schedule.time_start,
                time_end: booking.Schedule.time_end,
                status: booking.status,
                class_name: booking.Schedule.Class?.class_name || 'Unknown'
            }))
        };
    } catch (error) {
        console.error('Error validating member schedule conflict:', error);
        return {
            hasConflict: false,
            conflicts: [],
            error: error.message
        };
    }
};

/**
 * Validasi konflik jadwal untuk multiple members (untuk group/semi-private)
 * @param {Array} memberIds - Array ID members
 * @param {string} dateStart - Tanggal mulai (YYYY-MM-DD)
 * @param {string} timeStart - Waktu mulai (HH:MM:SS)
 * @param {string} timeEnd - Waktu selesai (HH:MM:SS)
 * @returns {Promise<Object>} Object berisi hasil validasi untuk semua members
 */
const validateMultipleMembersScheduleConflict = async (memberIds, dateStart, timeStart, timeEnd) => {
    try {
        const results = {};
        let hasAnyConflict = false;

        for (const memberId of memberIds) {
            const memberConflict = await validateMemberScheduleConflict(memberId, dateStart, timeStart, timeEnd);
            results[memberId] = memberConflict;
            
            if (memberConflict.hasConflict) {
                hasAnyConflict = true;
            }
        }

        return {
            hasAnyConflict,
            memberConflicts: results
        };
    } catch (error) {
        console.error('Error validating multiple members schedule conflict:', error);
        return {
            hasAnyConflict: false,
            memberConflicts: {},
            error: error.message
        };
    }
};

module.exports = {
    validateTrainerScheduleConflict,
    validateMemberScheduleConflict,
    validateMultipleMembersScheduleConflict
}; 