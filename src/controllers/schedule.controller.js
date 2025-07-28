const { Schedule, Class, Trainer, Member, Booking } = require('../models');
const { validateSessionAvailability, createSessionAllocation, getMemberSessionSummary } = require('../utils/sessionUtils');
const { autoCancelExpiredBookings, processWaitlistPromotion, getBookingStatistics } = require('../utils/bookingUtils');
const { validateTrainerScheduleConflict, validateMemberScheduleConflict } = require('../utils/scheduleUtils');
const ScheduleService = require('../services/schedule.service');
const twilioService = require('../services/twilio.service');
const logger = require('../config/logger');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Fungsi untuk generate dates untuk weekly repeat
const generateWeeklyDates = (startDate, untilDate, repeatDays = []) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const endDate = new Date(untilDate);
    
    // Jika tidak ada repeat_days, gunakan hari yang sama dengan startDate
    if (!repeatDays || repeatDays.length === 0) {
        const dayOfWeek = currentDate.getDay();
        repeatDays = [dayOfWeek];
    }
    
    while (currentDate <= endDate) {
        // Cek apakah hari ini termasuk dalam repeat_days
        const dayOfWeek = currentDate.getDay();
        if (repeatDays.includes(dayOfWeek)) {
            dates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1); // Tambah 1 hari
    }
    
    return dates;
};

// Fungsi untuk create multiple schedules untuk repeat
const createRepeatSchedules = async (scheduleData, repeatType, scheduleUntil, repeatDays = []) => {
    const schedules = [];
    
    if (repeatType === 'weekly' && scheduleUntil) {
        const dates = generateWeeklyDates(scheduleData.date_start, scheduleUntil, repeatDays);
        
        if (dates.length === 0) {
            throw new Error('No valid dates found for the specified repeat days');
        }
        
        // Buat schedule pertama sebagai main schedule
        const mainSchedule = await Schedule.create({
            ...scheduleData,
            date_start: dates[0].toISOString().split('T')[0],
            repeat_days: repeatDays
        });
        schedules.push(mainSchedule);
        
        // Buat schedule untuk tanggal-tanggal berikutnya
        const remainingDates = dates.slice(1);
        
        for (const date of remainingDates) {
            const schedule = await Schedule.create({
                ...scheduleData,
                date_start: date.toISOString().split('T')[0],
                repeat_type: 'none', // Set individual schedule sebagai 'none'
                schedule_until: null, // Set individual schedule sebagai null
                repeat_days: null, // Set individual schedule sebagai null
                parent_schedule_id: mainSchedule.id // Reference ke schedule utama
            });
            schedules.push(schedule);
        }
    } else {
        // Single schedule
        const schedule = await Schedule.create({
            ...scheduleData,
            repeat_days: repeatType === 'weekly' ? repeatDays : null
        });
        schedules.push(schedule);
    }
    
    return schedules;
};

// Get all group schedules with pagination and search
const getAllGroupSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('group', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('group', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = schedules.rows.map(schedule => 
            ScheduleService.formatScheduleData(schedule, true)
        );

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Group schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all group schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single group schedule by ID
const getGroupScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            },
            include: ScheduleService.getIncludeAssociations('group', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Group schedule not found'
            });
        }

        const scheduleData = ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Group schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get group schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new group schedule
const createGroupSchedule = async (req, res) => {
    try {
        const {
            class_id,
            trainer_id,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        // Validate class exists
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }

        // Validasi konflik jadwal trainer
        const trainerConflict = await validateTrainerScheduleConflict(
            trainer_id,
            date_start,
            time_start,
            time_end
        );

        if (trainerConflict.hasConflict) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer memiliki jadwal yang bentrok dengan schedule ini',
                data: {
                    conflicts: trainerConflict.conflicts
                }
            });
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            pax: parseInt(pax),
            type: 'group',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),
            waitlist_lock_minutes: parseInt(waitlist_lock_minutes),
            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(201).json({
            message: `Group schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                repeatType: repeat_type
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update group schedule
const updateGroupSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Group schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (pax !== undefined) updateData.pax = parseInt(pax);
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        if (waitlist_lock_minutes !== undefined) updateData.waitlist_lock_minutes = parseInt(waitlist_lock_minutes);
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(200).json({
            message: 'Group schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete group schedule
const deleteGroupSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Group schedule not found'
            });
        }

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Group schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get all semi-private schedules with pagination and search
const getAllSemiPrivateSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('semi_private', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('semi_private', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = schedules.rows.map(schedule => 
            ScheduleService.formatScheduleData(schedule, true)
        );

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Semi-private schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all semi-private schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single semi-private schedule by ID
const getSemiPrivateScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            },
            include: ScheduleService.getIncludeAssociations('semi_private', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Semi-private schedule not found'
            });
        }

        const scheduleData = ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Semi-private schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get semi-private schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new semi-private schedule
const createSemiPrivateSchedule = async (req, res) => {
    try {
        const {
            class_id,
            trainer_id,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        // Validate class exists
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }

        // Validasi konflik jadwal trainer
        const trainerConflict = await validateTrainerScheduleConflict(
            trainer_id,
            date_start,
            time_start,
            time_end
        );

        if (trainerConflict.hasConflict) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer memiliki jadwal yang bentrok dengan schedule ini',
                data: {
                    conflicts: trainerConflict.conflicts
                }
            });
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            pax: parseInt(pax),
            type: 'semi_private',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),
            waitlist_lock_minutes: parseInt(waitlist_lock_minutes),
            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(201).json({
            message: `Semi-private schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                repeatType: repeat_type
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update semi-private schedule
const updateSemiPrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Semi-private schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (pax !== undefined) updateData.pax = parseInt(pax);
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        if (waitlist_lock_minutes !== undefined) updateData.waitlist_lock_minutes = parseInt(waitlist_lock_minutes);
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(200).json({
            message: 'Semi-private schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete semi-private schedule
const deleteSemiPrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Semi-private schedule not found'
            });
        }

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Semi-private schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get all private schedules with pagination and search
const getAllPrivateSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('private', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('private', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = schedules.rows.map(schedule => 
            ScheduleService.formatScheduleData(schedule, true)
        );

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Private schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all private schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single private schedule by ID
const getPrivateScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            },
            include: ScheduleService.getIncludeAssociations('private', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Private schedule not found'
            });
        }

        const scheduleData = ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Private schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get private schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new private schedule with auto booking
const createPrivateSchedule = async (req, res) => {
    try {
        const {
            class_id,
            trainer_id,
            member_id, // Member yang akan di-assign
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        // Validate class exists
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }

        // Validate member exists
        const member = await Member.findByPk(member_id);
        if (!member) {
            return res.status(400).json({
                status: 'error',
                message: 'Member not found'
            });
        }

        // Validasi konflik jadwal trainer
        const trainerConflict = await validateTrainerScheduleConflict(
            trainer_id,
            date_start,
            time_start,
            time_end
        );

        if (trainerConflict.hasConflict) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer memiliki jadwal yang bentrok dengan schedule ini',
                data: {
                    conflicts: trainerConflict.conflicts
                }
            });
        }

        // Validasi konflik jadwal member
        const memberConflict = await validateMemberScheduleConflict(
            member_id,
            date_start,
            time_start,
            time_end
        );

        if (memberConflict.hasConflict) {
            return res.status(400).json({
                status: 'error',
                message: 'Member memiliki jadwal yang bentrok dengan schedule ini',
                data: {
                    conflicts: memberConflict.conflicts
                }
            });
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            member_id, // Assign member langsung
            pax: 1, // Private schedule selalu pax = 1
            type: 'private',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),
            waitlist_lock_minutes: parseInt(waitlist_lock_minutes),
            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);

        // Cek jatah sesi member sebelum booking
        const sessionValidation = await validateSessionAvailability(member_id, createdSchedules.length);
        
        if (!sessionValidation.isValid) {
            return res.status(400).json({
                status: 'error',
                message: 'Member tidak memiliki jatah sesi yang cukup untuk booking',
                data: {
                    member_id: member_id,
                    required_sessions: createdSchedules.length,
                    available_sessions: sessionValidation.totalAvailableSessions,
                    deficit: sessionValidation.deficit,
                    package_details: sessionValidation.packageDetails
                }
            });
        }

        // Buat alokasi sesi untuk booking
        const sessionAllocation = await createSessionAllocation(member_id, createdSchedules.length);

        // Auto booking untuk setiap schedule yang dibuat
        const bookings = [];
        for (let i = 0; i < createdSchedules.length; i++) {
            const schedule = createdSchedules[i];
            const allocation = sessionAllocation[i];

            const booking = await Booking.create({
                schedule_id: schedule.id,
                member_id: member_id,
                package_id: allocation.package_id,
                session_left: allocation.session_left,
                status: 'signup',
                booking_date: new Date(),
                notes: `Auto booking for private schedule using ${allocation.package_type} package`
            });
            
            bookings.push(booking);
        }

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                },
                {
                    model: Member,
                    as: 'assignedMember',
                    attributes: ['id', 'full_name', 'email', 'phone_number']
                }
            ]
        });

        res.status(201).json({
            message: `Private schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                totalBookings: bookings.length,
                repeatType: repeat_type,
                assignedMember: {
                    id: member.id,
                    full_name: member.full_name,
                    email: member.email
                }
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update private schedule
const updatePrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            member_id,
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            waitlist_lock_minutes,
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Private schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate member exists if being updated
        if (member_id) {
            const member = await Member.findByPk(member_id);
            if (!member) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Member not found'
                });
            }
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (member_id !== undefined) updateData.member_id = member_id;
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        if (waitlist_lock_minutes !== undefined) updateData.waitlist_lock_minutes = parseInt(waitlist_lock_minutes);
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Update booking jika member berubah
        if (member_id && member_id !== schedule.member_id) {
            await Booking.update(
                { member_id: member_id },
                { where: { schedule_id: schedule.id } }
            );
        }

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                },
                {
                    model: Member,
                    as: 'assignedMember',
                    attributes: ['id', 'full_name', 'email', 'phone_number']
                }
            ]
        });

        res.status(200).json({
            message: 'Private schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete private schedule
const deletePrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Private schedule not found'
            });
        }

        // Delete associated bookings
        await Booking.destroy({
            where: { schedule_id: schedule.id }
        });

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Private schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get schedule data for calendar view
const getScheduleCalendar = async (req, res) => {
    try {
        const { month, year, type, include_members = 'false' } = req.query;
        
        // Default to current month/year if not provided
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Validate month (1-12)
        if (targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({
                status: 'error',
                message: 'Bulan harus antara 1-12'
            });
        }
        
        // Build where clause
        const whereClause = {};
        

// Hitung tanggal awal dan akhir bulan
const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
const lastDayOfMonth = new Date(targetYear, targetMonth, 0);

// Tentukan hari dalam seminggu (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
const firstDayOfWeek = firstDayOfMonth.getDay();
const lastDayOfWeek = lastDayOfMonth.getDay();

// Hitung berapa hari yang perlu ditambahkan dari bulan sebelumnya
// Jika hari pertama bulan adalah Minggu (0), tidak perlu tambahan
// Jika hari pertama bulan adalah Senin (1), tambahkan 1 hari, dst.
const daysFromPrevMonth = firstDayOfWeek;

// Hitung berapa hari yang perlu ditambahkan dari bulan berikutnya
// Jika hari terakhir bulan adalah Sabtu (6), tidak perlu tambahan
// Jika hari terakhir bulan adalah Jumat (5), tambahkan 1 hari, dst.
const daysFromNextMonth = 6 - lastDayOfWeek;

// Buat tanggal awal dan akhir yang disesuaikan
const adjustedStartDate = new Date(firstDayOfMonth);
adjustedStartDate.setDate(firstDayOfMonth.getDate() - daysFromPrevMonth);

const adjustedEndDate = new Date(lastDayOfMonth);
adjustedEndDate.setDate(lastDayOfMonth.getDate() + daysFromNextMonth);

// Konversi ke format YYYY-MM-DD dengan timezone yang benar
const startDateStr = adjustedStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const endDateStr = adjustedEndDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

console.log('Date range with auto adjustment:', startDateStr, 'to', endDateStr); // Untuk debugging

whereClause.date_start = {
    [Op.between]: [startDateStr, endDateStr]
};
        
        // Filter by type if provided
        if (type && ['group', 'semi_private', 'private'].includes(type)) {
            whereClause.type = type;
        }
        
        const schedules = await Schedule.findAll({
            where: whereClause,
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture']
                },
                {
                    model: Booking,
                    where: {
                        status: {
                            [Op.in]: ['signup', 'waiting_list']
                        }
                    },
                    required: false,
                    attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'session_left', 'status', 'createdAt', 'updatedAt'],
                    include: include_members === 'true' ? [
                        {
                            model: Member,
                            attributes: ['id', 'full_name']
                        }
                    ] : []
                }
            ],
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });
        
        // Format data untuk calendar dengan informasi slot
        const formattedSchedules = schedules.map(schedule => {
            // Hitung booking berdasarkan status
            const signupBookings = schedule.Bookings.filter(b => b.status === 'signup');
            const waitlistBookings = schedule.Bookings.filter(b => b.status === 'waiting_list');
            
            // Tentukan kapasitas maksimal berdasarkan tipe kelas
            const maxCapacity = schedule.type === 'semi_private' ? 4 : 
                               schedule.type === 'private' ? 1 : 20;
            
            // Hitung slot tersisa
            const availableSlots = Math.max(0, maxCapacity - signupBookings.length);
            const isFull = availableSlots === 0;
            const hasWaitlist = waitlistBookings.length > 0;
            
            // Status kelas
            let status = 'available';
            if (isFull && hasWaitlist) {
                status = 'full_with_waitlist';
            } else if (isFull) {
                status = 'full';
            } else if (signupBookings.length < (schedule.min_signup || 1)) {
                status = 'minimum_not_met';
            }
            
            // Cek apakah sudah melewati cancel buffer time
            const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
            const currentDateTime = new Date();
            const cancelBufferMinutes = schedule.cancel_buffer_minutes || 120;
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));
            const isPastCancelDeadline = currentDateTime > cancelDeadline;
            
            const scheduleData = {
                id: schedule.id,
                class_name: schedule.Class?.class_name || '',
                class_color: schedule.Class?.color_sign || '#000000',
                trainer_name: schedule.Trainer?.title || '',
                trainer_picture: schedule.Trainer?.picture || '',
                type: schedule.type,
                date: schedule.date_start,
                time_start: schedule.time_start,
                time_end: schedule.time_end,
                
                // Informasi slot dan booking
                max_capacity: maxCapacity,
                current_signups: signupBookings.length,
                waitlist_count: waitlistBookings.length,
                available_slots: availableSlots,
                min_signup: schedule.min_signup || 1,
                
                // Status kelas
                status: status,
                is_full: isFull,
                has_waitlist: hasWaitlist,
                is_past_cancel_deadline: isPastCancelDeadline,
                
                // Informasi tambahan
                cancel_buffer_minutes: cancelBufferMinutes,
                can_book: !isPastCancelDeadline && (availableSlots > 0 || hasWaitlist),
                can_cancel: !isPastCancelDeadline
            };
            
            // Tambahkan detail member jika diminta
            if (include_members === 'true') {
                scheduleData.signup_members = signupBookings.map(b => ({
                    id: b.Member.id,
                    name: b.Member.full_name
                }));
                scheduleData.waitlist_members = waitlistBookings.map(b => ({
                    id: b.Member.id,
                    name: b.Member.full_name
                }));
            }
            
            return scheduleData;
        });
        
        // Group schedules by date for easier calendar rendering
        const schedulesByDate = {};
        formattedSchedules.forEach(schedule => {
            const date = schedule.date;
            if (!schedulesByDate[date]) {
                schedulesByDate[date] = [];
            }
            schedulesByDate[date].push(schedule);
        });
        
        // Hitung statistik
        const totalSchedules = formattedSchedules.length;
        const availableSchedules = formattedSchedules.filter(s => s.can_book).length;
        const fullSchedules = formattedSchedules.filter(s => s.is_full).length;
        const minimumNotMetSchedules = formattedSchedules.filter(s => s.status === 'minimum_not_met').length;
        
        res.status(200).json({
            success: true,
            message: 'Schedule calendar data retrieved successfully',
            data: {
                month: targetMonth,
                year: targetYear,
                filter_type: type || 'all',
                include_members: include_members === 'true',
                
                // Statistik
                total_schedules: totalSchedules,
                available_schedules: availableSchedules,
                full_schedules: fullSchedules,
                minimum_not_met_schedules: minimumNotMetSchedules,
                
                // Data calendar
                schedules_by_date: schedulesByDate,
                schedules: formattedSchedules
            }
        });
    } catch (error) {
        console.error('Get schedule calendar error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

module.exports = {
    getAllGroupSchedules,
    getGroupScheduleById,
    createGroupSchedule,
    updateGroupSchedule,
    deleteGroupSchedule,
    getAllSemiPrivateSchedules,
    getSemiPrivateScheduleById,
    createSemiPrivateSchedule,
    updateSemiPrivateSchedule,
    deleteSemiPrivateSchedule,
    getAllPrivateSchedules,
    getPrivateScheduleById,
    createPrivateSchedule,
    updatePrivateSchedule,
    deletePrivateSchedule,
    getScheduleCalendar
}; 