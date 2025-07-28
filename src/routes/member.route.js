const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const {
  createMemberSchema,
  updateMemberSchema,
  getMembersQuerySchema,
  memberIdSchema,
  getMyClassesSchema,

} = require('../validations/member.validation');

// My Classes endpoints (user only - no admin role required) - HARUS DI ATAS ROUTE DENGAN PARAMETER
router.get('/my-classes', 
  validateToken, 
  validate(getMyClassesSchema, 'query'), 
  memberController.getMyClasses
);


// Admin routes (require admin role)
router.get('/', 
  validateToken,
  checkRole('admin'),
  validate(getMembersQuerySchema, 'query'),
  memberController.getAllMembers
);

router.get('/stats', 
  validateToken,
  checkRole('admin'),
  memberController.getMemberStats
);

router.get('/:id',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberById
);

router.post('/',
  validateToken,
  checkRole('admin'),
  validate(createMemberSchema, 'body'),
  memberController.createMember
);

router.put('/:id',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  validate(updateMemberSchema, 'body'),
  memberController.updateMember
);

router.delete('/:id',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.deleteMember
);

module.exports = router; 