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

} = require('../validations/member.validation');



// Admin routes (require admin role)
router.get('/', 
  validateToken,
  checkRole('admin'),
  validate(getMembersQuerySchema, 'query'),
  memberController.getAllMembers
);



router.get('/:id',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberById
);

// Get member profile data only
router.get('/:id/profile',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberProfile
);

// Get member packages data only
router.get('/:id/packages',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberPackages
);

// Get member bookings data only
router.get('/:id/bookings',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberBookings
);

// Get member detail with 3 tabs (Profile, Package, Bookings)
router.get('/:id/detail',
  validateToken,
  checkRole('admin'),
  validate(memberIdSchema, 'params'),
  memberController.getMemberDetailById
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