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

        // Validate that at least one picture is uploaded
        if (!req.files || (!req.files.picturePortrait && !req.files.pictureLandscape)) {
            return res.status(400).json({
                message: 'At least one picture (portrait or landscape) is required'
            });
        }

        // Check if banner with same title already exists
        const existingBanner = await Banner.findOne({ where: { title } });
        if (existingBanner) {
            // Delete uploaded files if banner already exists
            if (req.files.picturePortrait) {
                const portraitPath = path.join(__dirname, '../../uploads/banners/', req.files.picturePortrait[0].filename);
                if (fs.existsSync(portraitPath)) {
                    fs.unlinkSync(portraitPath);
                }
            }
            if (req.files.pictureLandscape) {
                const landscapePath = path.join(__dirname, '../../uploads/banners/', req.files.pictureLandscape[0].filename);
                if (fs.existsSync(landscapePath)) {
                    fs.unlinkSync(landscapePath);
                }
            }
            return res.status(400).json({
                message: 'Banner with this title already exists'
            });
        }

        const bannerData = {
            title,
            picturePortrait: req.files.picturePortrait ? req.files.picturePortrait[0].filename : null,
            pictureLandscape: req.files.pictureLandscape ? req.files.pictureLandscape[0].filename : null
        };

        const banner = await Banner.create(bannerData);

        res.status(201).json({
            message: 'Banner created successfully',
            data: banner
        });
    } catch (error) {
        // Delete uploaded files if error occurs
        if (req.files) {
            if (req.files.picturePortrait) {
                const portraitPath = path.join(__dirname, '../../uploads/banners/', req.files.picturePortrait[0].filename);
                if (fs.existsSync(portraitPath)) {
                    fs.unlinkSync(portraitPath);
                }
            }
            if (req.files.pictureLandscape) {
                const landscapePath = path.join(__dirname, '../../uploads/banners/', req.files.pictureLandscape[0].filename);
                if (fs.existsSync(landscapePath)) {
                    fs.unlinkSync(landscapePath);
                }
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
            // Delete uploaded files if banner not found
            if (req.files) {
                if (req.files.picturePortrait) {
                    const portraitPath = path.join(__dirname, '../../uploads/banners/', req.files.picturePortrait[0].filename);
                    if (fs.existsSync(portraitPath)) {
                        fs.unlinkSync(portraitPath);
                    }
                }
                if (req.files.pictureLandscape) {
                    const landscapePath = path.join(__dirname, '../../uploads/banners/', req.files.pictureLandscape[0].filename);
                    if (fs.existsSync(landscapePath)) {
                        fs.unlinkSync(landscapePath);
                    }
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
                // Delete uploaded files if title already exists
                if (req.files) {
                    if (req.files.picturePortrait) {
                        const portraitPath = path.join(__dirname, '../../uploads/banners/', req.files.picturePortrait[0].filename);
                        if (fs.existsSync(portraitPath)) {
                            fs.unlinkSync(portraitPath);
                        }
                    }
                    if (req.files.pictureLandscape) {
                        const landscapePath = path.join(__dirname, '../../uploads/banners/', req.files.pictureLandscape[0].filename);
                        if (fs.existsSync(landscapePath)) {
                            fs.unlinkSync(landscapePath);
                        }
                    }
                }
                return res.status(400).json({
                    message: 'Banner with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;

        // Handle picture updates
        if (req.files) {
            // Handle portrait picture update
            if (req.files.picturePortrait) {
                // Delete old portrait picture if exists
                if (banner.picturePortrait) {
                    const oldPortraitPath = path.join(__dirname, '../../uploads/banners/', banner.picturePortrait);
                    if (fs.existsSync(oldPortraitPath)) {
                        fs.unlinkSync(oldPortraitPath);
                    }
                }
                updateData.picturePortrait = req.files.picturePortrait[0].filename;
            }
            
            // Handle landscape picture update
            if (req.files.pictureLandscape) {
                // Delete old landscape picture if exists
                if (banner.pictureLandscape) {
                    const oldLandscapePath = path.join(__dirname, '../../uploads/banners/', banner.pictureLandscape);
                    if (fs.existsSync(oldLandscapePath)) {
                        fs.unlinkSync(oldLandscapePath);
                    }
                }
                updateData.pictureLandscape = req.files.pictureLandscape[0].filename;
            }
        }

        await banner.update(updateData);

        res.status(200).json({
            message: 'Banner updated successfully',
            data: banner
        });
    } catch (error) {
        // Delete uploaded files if error occurs
        if (req.files) {
            if (req.files.picturePortrait) {
                const portraitPath = path.join(__dirname, '../../uploads/banners/', req.files.picturePortrait[0].filename);
                if (fs.existsSync(portraitPath)) {
                    fs.unlinkSync(portraitPath);
                }
            }
            if (req.files.pictureLandscape) {
                const landscapePath = path.join(__dirname, '../../uploads/banners/', req.files.pictureLandscape[0].filename);
                if (fs.existsSync(landscapePath)) {
                    fs.unlinkSync(landscapePath);
                }
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

        // Delete picture files if they exist
        if (banner.picturePortrait) {
            const portraitPath = path.join(__dirname, '../../uploads/banners/', banner.picturePortrait);
            if (fs.existsSync(portraitPath)) {
                fs.unlinkSync(portraitPath);
            }
        }
        if (banner.pictureLandscape) {
            const landscapePath = path.join(__dirname, '../../uploads/banners/', banner.pictureLandscape);
            if (fs.existsSync(landscapePath)) {
                fs.unlinkSync(landscapePath);
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