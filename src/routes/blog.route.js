const express = require('express');
const router = express.Router();
const { 
    getAllBlogs, 
    getBlogById, 
    createBlog, 
    updateBlog, 
    deleteBlog
} = require('../controllers/blog.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    createBlogSchema, 
    updateBlogSchema, 
    getBlogSchema 
} = require('../validations/blog.validation');

// Public routes - semua user bisa akses
router.get('/', getAllBlogs);
router.get('/:id', validate(getBlogSchema, 'params'), getBlogById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('blogs', true), // required untuk create
    handleUploadError,
    validate(createBlogSchema), 
    createBlog
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('blogs', false), // optional untuk update
    handleUploadError,
    validate(getBlogSchema, 'params'),
    validate(updateBlogSchema), 
    updateBlog
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getBlogSchema, 'params'),
    deleteBlog
);

module.exports = router; 