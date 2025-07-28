const { Banner } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Get all banners with pagination and search
const getAllBanners = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            title: { [Op.like]: `%${search}%` }
        } : {};

        const banners = await Banner.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(banners.count / limit);

        res.status(200).json({
            message: 'Banners retrieved successfully',
            data: {
                banners: banners.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: banners.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all banners error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single banner by ID
const getBannerById = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findByPk(id);

        if (!banner) {
            return res.status(404).json({
                message: 'Banner not found'
            });
        }

        res.status(200).json({
            message: 'Banner retrieved successfully',
            data: banner
        });
    } catch (error) {
        console.error('Get banner by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new banner
const createBanner = async (req, res) => {
    try {
        const { title } = req.body;

        if (!req.file) {
            return res.status(400).json({
                message: 'Picture is required'
            });
        }

        // Check if banner with same title already exists
        const existingBanner = await Banner.findOne({ where: { title } });
        if (existingBanner) {
            // Delete uploaded file if banner already exists
            const filePath = path.join(__dirname, '../../uploads/banners/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                message: 'Banner with this title already exists'
            });
        }

        const banner = await Banner.create({
            title,
            picture: req.file.filename
        });

        res.status(201).json({
            message: 'Banner created successfully',
            data: banner
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/banners/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create banner error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update banner
const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        const banner = await Banner.findByPk(id);

        if (!banner) {
            // Delete uploaded file if banner not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/banners/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                message: 'Banner not found'
            });
        }

        // Check if title is being updated and if it already exists
        if (title && title !== banner.title) {
            const existingBanner = await Banner.findOne({ 
                where: { 
                    title,
                    id: { [Op.ne]: id } // Exclude current banner
                }
            });
            if (existingBanner) {
                // Delete uploaded file if title already exists
                if (req.file) {
                    const filePath = path.join(__dirname, '../../uploads/banners/', req.file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                return res.status(400).json({
                    message: 'Banner with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (banner.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/banners/', banner.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await banner.update(updateData);

        res.status(200).json({
            message: 'Banner updated successfully',
            data: banner
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/banners/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update banner error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete banner
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findByPk(id);

        if (!banner) {
            return res.status(404).json({
                message: 'Banner not found'
            });
        }

        // Delete picture file if exists
        if (banner.picture) {
            const picturePath = path.join(__dirname, '../../uploads/banners/', banner.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await banner.destroy();

        res.status(200).json({
            message: 'Banner deleted successfully'
        });
    } catch (error) {
        console.error('Delete banner error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner
}; 