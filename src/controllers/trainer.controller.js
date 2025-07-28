const { Trainer } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Get all trainers with pagination and search
const getAllTrainers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            [Op.or]: [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ]
        } : {};

        const trainers = await Trainer.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(trainers.count / limit);

        res.status(200).json({
            message: 'Trainers retrieved successfully',
            data: {
                trainers: trainers.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: trainers.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all trainers error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single trainer by ID
const getTrainerById = async (req, res) => {
    try {
        const { id } = req.params;

        const trainer = await Trainer.findByPk(id);

        if (!trainer) {
            return res.status(404).json({
                message: 'Trainer not found'
            });
        }

        res.status(200).json({
            message: 'Trainer retrieved successfully',
            data: trainer
        });
    } catch (error) {
        console.error('Get trainer by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new trainer
const createTrainer = async (req, res) => {
    try {
        const { title, description, instagram, tiktok } = req.body;

        // Check if trainer with same title already exists
        const existingTrainer = await Trainer.findOne({ where: { title } });
        if (existingTrainer) {
            // Delete uploaded file if trainer already exists
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/trainers/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(400).json({
                message: 'Trainer with this title already exists'
            });
        }

        const trainerData = {
            title,
            description,
            instagram: instagram || null,
            tiktok: tiktok || null,
            picture: req.file ? req.file.filename : null
        };

        const trainer = await Trainer.create(trainerData);

        res.status(201).json({
            message: 'Trainer created successfully',
            data: trainer
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/trainers/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create trainer error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update trainer
const updateTrainer = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, instagram, tiktok } = req.body;

        const trainer = await Trainer.findByPk(id);

        if (!trainer) {
            // Delete uploaded file if trainer not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/trainers/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                message: 'Trainer not found'
            });
        }

        // Check if title is being updated and if it already exists
        if (title && title !== trainer.title) {
            const existingTrainer = await Trainer.findOne({ 
                where: { 
                    title,
                    id: { [Op.ne]: id } // Exclude current trainer
                }
            });
            if (existingTrainer) {
                // Delete uploaded file if title already exists
                if (req.file) {
                    const filePath = path.join(__dirname, '../../uploads/trainers/', req.file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                return res.status(400).json({
                    message: 'Trainer with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (instagram !== undefined) updateData.instagram = instagram || null;
        if (tiktok !== undefined) updateData.tiktok = tiktok || null;

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (trainer.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/trainers/', trainer.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await trainer.update(updateData);

        res.status(200).json({
            message: 'Trainer updated successfully',
            data: trainer
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/trainers/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update trainer error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete trainer
const deleteTrainer = async (req, res) => {
    try {
        const { id } = req.params;

        const trainer = await Trainer.findByPk(id);

        if (!trainer) {
            return res.status(404).json({
                message: 'Trainer not found'
            });
        }

        // Delete picture file if exists
        if (trainer.picture) {
            const picturePath = path.join(__dirname, '../../uploads/trainers/', trainer.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await trainer.destroy();

        res.status(200).json({
            message: 'Trainer deleted successfully'
        });
    } catch (error) {
        console.error('Delete trainer error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete trainer picture
const deleteTrainerPicture = async (req, res) => {
    try {
        const { id } = req.params;

        const trainer = await Trainer.findByPk(id);

        if (!trainer) {
            return res.status(404).json({
                message: 'Trainer not found'
            });
        }

        // Delete picture file if exists
        if (trainer.picture) {
            const picturePath = path.join(__dirname, '../../uploads/trainers/', trainer.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        // Update trainer to remove picture
        await trainer.update({ picture: null });

        res.status(200).json({
            message: 'Trainer picture deleted successfully'
        });
    } catch (error) {
        console.error('Delete trainer picture error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllTrainers,
    getTrainerById,
    createTrainer,
    updateTrainer,
    deleteTrainer,
    deleteTrainerPicture
}; 