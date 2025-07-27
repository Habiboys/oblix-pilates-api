const { Class } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Get all classes
const getAllClasses = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        
        const whereClause = {};
        
        // Add search filter
        if (search) {
            whereClause.class_name = {
                [Op.like]: `%${search}%`
            };
        }
        
        const offset = (page - 1) * limit;
        
        const classes = await Class.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        const totalPages = Math.ceil(classes.count / limit);
        
        res.status(200).json({
            status: 'success',
            message: 'Classes retrieved successfully',
            data: {
                classes: classes.rows,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_items: classes.count,
                    items_per_page: parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Get all classes error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Get class by ID
const getClassById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const classData = await Class.findByPk(id);
        
        if (!classData) {
            return res.status(404).json({
                status: 'error',
                message: 'Class not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            message: 'Class retrieved successfully',
            data: classData
        });
    } catch (error) {
        logger.error('Get class by ID error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Create new class
const createClass = async (req, res) => {
    try {
        const { class_name, color_sign } = req.body;
        
        // Check if class name already exists
        const existingClass = await Class.findOne({
            where: { class_name }
        });
        
        if (existingClass) {
            return res.status(400).json({
                status: 'error',
                message: 'Class name already exists'
            });
        }
        
        const newClass = await Class.create({
            class_name,
            color_sign
        });
        
        res.status(201).json({
            status: 'success',
            message: 'Class created successfully',
            data: newClass
        });
    } catch (error) {
        logger.error('Create class error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Update class
const updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { class_name, color_sign } = req.body;
        
        const classData = await Class.findByPk(id);
        
        if (!classData) {
            return res.status(404).json({
                status: 'error',
                message: 'Class not found'
            });
        }
        
        // Check if class name already exists (excluding current class)
        if (class_name && class_name !== classData.class_name) {
            const existingClass = await Class.findOne({
                where: { 
                    class_name,
                    id: { [Op.ne]: id }
                }
            });
            
            if (existingClass) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class name already exists'
                });
            }
        }
        
        await classData.update({
            class_name: class_name || classData.class_name,
            color_sign: color_sign || classData.color_sign
        });
        
        res.status(200).json({
            status: 'success',
            message: 'Class updated successfully',
            data: classData
        });
    } catch (error) {
        logger.error('Update class error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Delete class
const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        
        const classData = await Class.findByPk(id);
        
        if (!classData) {
            return res.status(404).json({
                status: 'error',
                message: 'Class not found'
            });
        }
        
        // Check if class is being used in schedules
        const scheduleCount = await classData.countSchedules();
        
        if (scheduleCount > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot delete class. It is being used in ${scheduleCount} schedule(s)`
            });
        }
        
        await classData.destroy();
        
        res.status(200).json({
            status: 'success',
            message: 'Class deleted successfully'
        });
    } catch (error) {
        logger.error('Delete class error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Get classes for dropdown/select
const getClassesForSelect = async (req, res) => {
    try {
        const classes = await Class.findAll({
            attributes: ['id', 'class_name', 'color_sign'],
            order: [['class_name', 'ASC']]
        });
        
        res.status(200).json({
            status: 'success',
            message: 'Classes retrieved successfully',
            data: classes
        });
    } catch (error) {
        logger.error('Get classes for select error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass,
    getClassesForSelect
}; 