const { Faq } = require('../models');
const { Op } = require('sequelize');

// Get all FAQs with pagination and search
const getAllFaqs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            [Op.or]: [
                { title: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ]
        } : {};

        const faqs = await Faq.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(faqs.count / limit);

        res.status(200).json({
            message: 'FAQs retrieved successfully',
            data: {
                faqs: faqs.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: faqs.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all FAQs error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single FAQ by ID
const getFaqById = async (req, res) => {
    try {
        const { id } = req.params;

        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({
                message: 'FAQ not found'
            });
        }

        res.status(200).json({
            message: 'FAQ retrieved successfully',
            data: faq
        });
    } catch (error) {
        console.error('Get FAQ by ID error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new FAQ
const createFaq = async (req, res) => {
    try {
        const { title, content } = req.body;

        // Check if FAQ with same title already exists
        const existingFaq = await Faq.findOne({ where: { title } });
        if (existingFaq) {
            return res.status(400).json({
                message: 'FAQ with this title already exists'
            });
        }

        const faq = await Faq.create({
            title,
            content
        });

        res.status(201).json({
            message: 'FAQ created successfully',
            data: faq
        });
    } catch (error) {
        console.error('Create FAQ error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update FAQ
const updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({
                message: 'FAQ not found'
            });
        }

        // Check if title is being updated and if it already exists
        if (title && title !== faq.title) {
            const existingFaq = await Faq.findOne({ 
                where: { 
                    title,
                    id: { [Op.ne]: id } // Exclude current FAQ
                }
            });
            if (existingFaq) {
                return res.status(400).json({
                    message: 'FAQ with this title already exists'
                });
            }
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (content) updateData.content = content;

        await faq.update(updateData);

        res.status(200).json({
            message: 'FAQ updated successfully',
            data: faq
        });
    } catch (error) {
        console.error('Update FAQ error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete FAQ
const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;

        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({
                message: 'FAQ not found'
            });
        }

        await faq.destroy();

        res.status(200).json({
            message: 'FAQ deleted successfully'
        });
    } catch (error) {
        console.error('Delete FAQ error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllFaqs,
    getFaqById,
    createFaq,
    updateFaq,
    deleteFaq
}; 