const express = require('express');
const router = express.Router();
const myClassesController = require('../controllers/myclases.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const {
  getMyClassesSchema,
} = require('../validations/myclasses.validation');

// My Classes endpoints (user only - no admin role required) - HARUS DI ATAS ROUTE DENGAN PARAMETER
router.get('/', 
  validateToken, 
  checkRole('user'),
  validate(getMyClassesSchema, 'query'), 
  myClassesController.getMyClasses
);



module.exports = router; 