const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const {
  createMemberSchema,
  updateMemberSchema,
  getMembersQuerySchema,
  memberIdSchema
} = require('../validations/member.validation');

// Apply authentication middleware to all routes
router.use(validateToken);
router.use(checkRole('admin'));

// Get all members with pagination and search
router.get('/', 
  validate(getMembersQuerySchema, 'query'),
  memberController.getAllMembers
);

// Get member statistics
router.get('/stats', memberController.getMemberStats);

// Get member by ID
router.get('/:id',
  validate(memberIdSchema, 'params'),
  memberController.getMemberById
);

// Create new member
router.post('/',
  validate(createMemberSchema, 'body'),
  memberController.createMember
);

// Update member
router.put('/:id',
  validate(memberIdSchema, 'params'),
  validate(updateMemberSchema, 'body'),
  memberController.updateMember
);

// Delete member
router.delete('/:id',
  validate(memberIdSchema, 'params'),
  memberController.deleteMember
);

module.exports = router; 