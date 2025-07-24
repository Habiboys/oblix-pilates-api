const { Schedule, Class, Trainer, Member, Booking } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Fungsi untuk generate dates untuk weekly repeat
const generateWeeklyDates = (startDate, untilDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const endDate = new Date(untilDate);
    
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7); // Tambah 7 hari
    }
    
    return dates;
};

// Fungsi untuk create multiple schedules untuk repeat
const createRepeatSchedules = async (scheduleData, repeatType, scheduleUntil) => {
    const schedules = [];
    
    if (repeatType === 'weekly' && scheduleUntil) {
        // Buat schedule utama dulu
        const mainSchedule = await Schedule.create(scheduleData);
        schedules.push(mainSchedule);
        
        const dates = generateWeeklyDates(scheduleData.date_start, scheduleUntil);
        
        // Skip tanggal pertama karena sudah dibuat sebagai main schedule
        const remainingDates = dates.slice(1);
        
        for (const date of remainingDates) {
            const schedule = await Schedule.create({
                ...scheduleData,
                date_start: date.toISOString().split('T')[0],
                repeat_type: 'none', // Set individual schedule sebagai 'none'
                schedule_until: null, // Set individual schedule sebagai null
                parent_schedule_id: mainSchedule.id // Reference ke schedule utama
            });
            schedules.push(schedule);
        }
    } else {
        // Single schedule
        const schedule = await Schedule.create(scheduleData);
        schedules.push(schedule);
    }
    
    return schedules;
};

// Get all group schedules with pagination and search
const getAllGroupSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {
            type: 'group'
        };

        // Add search filter
        if (search) {
            whereClause['$Class.class_name$'] = { [Op.iLike]: `%${search}%` };
        }

        // Add date filter
        if (date) {
            whereClause.date_start = date;
        }

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            message: 'Group schedules retrieved successfully',
            data: {
                schedules: schedules.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all group schedules error:', error);
        res.status(500).json({ 
            status: 'error',
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

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Group schedule not found'
            });
        }

        res.status(200).json({
            message: 'Group schedule retrieved successfully',
            data: schedule
        });
    } catch (error) {
        console.error('Get group schedule by ID error:', error);
        res.status(500).json({ 
            status: 'error',
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
            cancel_buffer_minutes
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
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until);

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
            cancel_buffer_minutes
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

        const whereClause = {
            type: 'semi_private'
        };

        // Add search filter
        if (search) {
            whereClause['$Class.class_name$'] = { [Op.iLike]: `%${search}%` };
        }

        // Add date filter
        if (date) {
            whereClause.date_start = date;
        }

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            message: 'Semi-private schedules retrieved successfully',
            data: {
                schedules: schedules.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all semi-private schedules error:', error);
        res.status(500).json({ 
            status: 'error',
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

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Semi-private schedule not found'
            });
        }

        res.status(200).json({
            message: 'Semi-private schedule retrieved successfully',
            data: schedule
        });
    } catch (error) {
        console.error('Get semi-private schedule by ID error:', error);
        res.status(500).json({ 
            status: 'error',
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
            cancel_buffer_minutes
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
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until);

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
            cancel_buffer_minutes
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

        const whereClause = {
            type: 'private'
        };

        // Add search filter
        if (search) {
            whereClause['$Class.class_name$'] = { [Op.iLike]: `%${search}%` };
        }

        // Add date filter
        if (date) {
            whereClause.date_start = date;
        }

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
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
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            message: 'Private schedules retrieved successfully',
            data: {
                schedules: schedules.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all private schedules error:', error);
        res.status(500).json({ 
            status: 'error',
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

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Private schedule not found'
            });
        }

        res.status(200).json({
            message: 'Private schedule retrieved successfully',
            data: schedule
        });
    } catch (error) {
        console.error('Get private schedule by ID error:', error);
        res.status(500).json({ 
            status: 'error',
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
            cancel_buffer_minutes
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
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until);

        // Auto booking untuk setiap schedule yang dibuat
        const bookings = [];
        for (const schedule of createdSchedules) {
            const booking = await Booking.create({
                schedule_id: schedule.id,
                member_id: member_id,
                status: 'confirmed', // Auto confirmed untuk private schedule
                booking_date: new Date(),
                notes: 'Auto booking for private schedule'
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
            cancel_buffer_minutes
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
    deletePrivateSchedule
}; 