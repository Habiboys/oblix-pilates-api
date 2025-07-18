const { Gallery } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Get all galleries with pagination and search
const getAllGalleries = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            title: { [Op.iLike]: `%${search}%` }
        } : {};

        const galleries = await Gallery.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(galleries.count / limit);

        res.status(200).json({
            message: 'Galleries retrieved successfully',
            data: {
                galleries: galleries.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: galleries.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all galleries error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single gallery by ID
const getGalleryById = async (req, res) => {
    try {
        const { id } = req.params;

        const gallery = await Gallery.findByPk(id);

        if (!gallery) {
            return res.status(404).json({
                message: 'Gallery not found'
            });
        }

        res.status(200).json({
            message: 'Gallery retrieved successfully',
            data: gallery
        });
    } catch (error) {
        console.error('Get gallery by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new gallery
const createGallery = async (req, res) => {
    try {
        const { title } = req.body;

        if (!req.file) {
            return res.status(400).json({
                message: 'Picture is required'
            });
        }

        // Check if gallery with same title already exists
        const existingGallery = await Gallery.findOne({ where: { title } });
        if (existingGallery) {
            // Delete uploaded file if gallery already exists
            const filePath = path.join(__dirname, '../../uploads/galleries/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                message: 'Gallery with this title already exists'
            });
        }

        const gallery = await Gallery.create({
            title,
            picture: req.file.filename
        });

        res.status(201).json({
            message: 'Gallery created successfully',
            data: gallery
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/galleries/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create gallery error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update gallery
const updateGallery = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        const gallery = await Gallery.findByPk(id);

        if (!gallery) {
            // Delete uploaded file if gallery not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/galleries/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                message: 'Gallery not found'
            });
        }

        // Check if title is being updated and if it already exists
        if (title && title !== gallery.title) {
            const existingGallery = await Gallery.findOne({ 
                where: { 
                    title,
                    id: { [Op.ne]: id } // Exclude current gallery
                }
            });
            if (existingGallery) {
                // Delete uploaded file if title already exists
                if (req.file) {
                    const filePath = path.join(__dirname, '../../uploads/galleries/', req.file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                return res.status(400).json({
                    message: 'Gallery with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (gallery.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/galleries/', gallery.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await gallery.update(updateData);

        res.status(200).json({
            message: 'Gallery updated successfully',
            data: gallery
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/galleries/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update gallery error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete gallery
const deleteGallery = async (req, res) => {
    try {
        const { id } = req.params;

        const gallery = await Gallery.findByPk(id);

        if (!gallery) {
            return res.status(404).json({
                message: 'Gallery not found'
            });
        }

        // Delete picture file if exists
        if (gallery.picture) {
            const picturePath = path.join(__dirname, '../../uploads/galleries/', gallery.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await gallery.destroy();

        res.status(200).json({
            message: 'Gallery deleted successfully'
        });
    } catch (error) {
        console.error('Delete gallery error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllGalleries,
    getGalleryById,
    createGallery,
    updateGallery,
    deleteGallery
}; 