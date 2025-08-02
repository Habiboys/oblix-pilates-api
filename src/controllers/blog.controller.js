const { Blog } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { generateUniqueSlug } = require('../utils/slugUtils');

// Get all blogs with pagination and search
const getAllBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            [Op.or]: [
                { title: { [Op.like]: `%${search}%` } },
                { content: { [Op.like]: `%${search}%` } },
                { slug: { [Op.like]: `%${search}%` } }
            ]
        } : {};

        const { count, rows: blogs } = await Blog.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: ['id', 'title', 'slug', 'picture', 'createdAt', 'updatedAt']
        });

        const totalPages = Math.ceil(count / limit);

        res.status(200).json({
            message: 'Blogs retrieved successfully',
            data: {
                blogs,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all blogs error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get blog by ID
const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findByPk(id);

        if (!blog) {
            return res.status(404).json({
                message: 'Blog not found'
            });
        }

        res.status(200).json({
            message: 'Blog retrieved successfully',
            data: blog
        });
    } catch (error) {
        console.error('Get blog by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get blog by slug
const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await Blog.findOne({
            where: { slug }
        });

        if (!blog) {
            return res.status(404).json({
                message: 'Blog not found'
            });
        }

        res.status(200).json({
            message: 'Blog retrieved successfully',
            data: blog
        });
    } catch (error) {
        console.error('Get blog by slug error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new blog
const createBlog = async (req, res) => {
    try {
        const { title, content } = req.body;

        // Check if blog with same title already exists
        const existingBlog = await Blog.findOne({ where: { title } });
        if (existingBlog) {
            // Delete uploaded file if blog already exists
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/blogs/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(400).json({
                message: 'Blog with this title already exists'
            });
        }

        // Generate unique slug
        const checkSlugExists = async (slug) => {
            const existing = await Blog.findOne({ where: { slug } });
            return !!existing;
        };
        
        const slug = await generateUniqueSlug(title, checkSlugExists);

        const blogData = {
            title,
            slug,
            content,
            picture: req.file ? req.file.filename : null
        };

        const blog = await Blog.create(blogData);

        res.status(201).json({
            message: 'Blog created successfully',
            data: blog
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/blogs/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create blog error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update blog
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const blog = await Blog.findByPk(id);

        if (!blog) {
            // Delete uploaded file if blog not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/blogs/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                message: 'Blog not found'
            });
        }

        // Check if title is being updated and if it already exists
        if (title && title !== blog.title) {
            const existingBlog = await Blog.findOne({ 
                where: { 
                    title,
                    id: { [Op.ne]: id } // Exclude current blog
                }
            });
            if (existingBlog) {
                // Delete uploaded file if title already exists
                if (req.file) {
                    const filePath = path.join(__dirname, '../../uploads/blogs/', req.file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                return res.status(400).json({
                    message: 'Blog with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) {
            updateData.title = title;
            // Generate new slug if title changed
            if (title !== blog.title) {
                const checkSlugExists = async (slug) => {
                    const existing = await Blog.findOne({ 
                        where: { 
                            slug,
                            id: { [Op.ne]: id } // Exclude current blog
                        }
                    });
                    return !!existing;
                };
                updateData.slug = await generateUniqueSlug(title, checkSlugExists);
            }
        }
        if (content !== undefined) updateData.content = content;

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (blog.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/blogs/', blog.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await blog.update(updateData);

        res.status(200).json({
            message: 'Blog updated successfully',
            data: blog
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/blogs/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update blog error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete blog
const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findByPk(id);

        if (!blog) {
            return res.status(404).json({
                message: 'Blog not found'
            });
        }

        // Delete picture file if exists
        if (blog.picture) {
            const picturePath = path.join(__dirname, '../../uploads/blogs/', blog.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await blog.destroy();

        res.status(200).json({
            message: 'Blog deleted successfully'
        });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllBlogs,
    getBlogById,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog
}; 