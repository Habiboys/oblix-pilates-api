const { Testimonial } = require('../models');
const { Op } = require('sequelize');

// Get all testimonials with pagination and search
const getAllTestimonials = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            [Op.or]: [
                { name: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ]
        } : {};

        const testimonials = await Testimonial.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(testimonials.count / limit);

        res.status(200).json({
            message: 'Testimonials retrieved successfully',
            data: {
                testimonials: testimonials.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: testimonials.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all testimonials error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single testimonial by ID
const getTestimonialById = async (req, res) => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findByPk(id);

        if (!testimonial) {
            return res.status(404).json({
                message: 'Testimonial not found'
            });
        }

        res.status(200).json({
            message: 'Testimonial retrieved successfully',
            data: testimonial
        });
    } catch (error) {
        console.error('Get testimonial by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new testimonial
const createTestimonial = async (req, res) => {
    try {
        const { name, age, content } = req.body;

        const testimonial = await Testimonial.create({
            name,
            age,
            content
        });

        res.status(201).json({
            message: 'Testimonial created successfully',
            data: testimonial
        });
    } catch (error) {
        console.error('Create testimonial error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update testimonial
const updateTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, age, content } = req.body;

        const testimonial = await Testimonial.findByPk(id);

        if (!testimonial) {
            return res.status(404).json({
                message: 'Testimonial not found'
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (age !== undefined) updateData.age = age;
        if (content !== undefined) updateData.content = content;

        await testimonial.update(updateData);

        res.status(200).json({
            message: 'Testimonial updated successfully',
            data: testimonial
        });
    } catch (error) {
        console.error('Update testimonial error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete testimonial
const deleteTestimonial = async (req, res) => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findByPk(id);

        if (!testimonial) {
            return res.status(404).json({
                message: 'Testimonial not found'
            });
        }

        await testimonial.destroy();

        res.status(200).json({
            message: 'Testimonial deleted successfully'
        });
    } catch (error) {
        console.error('Delete testimonial error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllTestimonials,
    getTestimonialById,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial
}; 