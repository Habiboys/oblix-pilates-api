const Joi = require('joi');

// Validation schema for creating member
const createMemberSchema = Joi.object({
  full_name: Joi.string()
    .min(2)
    .max(150)
    .required()
    .messages({
      'string.min': 'Nama lengkap minimal 2 karakter',
      'string.max': 'Nama lengkap maksimal 150 karakter',
      'any.required': 'Nama lengkap wajib diisi'
    }),
  
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Username hanya boleh berisi huruf dan angka',
      'string.min': 'Username minimal 3 karakter',
      'string.max': 'Username maksimal 50 karakter',
      'any.required': 'Username wajib diisi'
    }),
  
  phone_number: Joi.string()
    .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Format nomor telepon tidak valid',
      'any.required': 'Nomor telepon wajib diisi'
    }),
  
  dob: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Tanggal lahir tidak boleh lebih dari hari ini',
      'any.required': 'Tanggal lahir wajib diisi'
    }),
  
  address: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Alamat maksimal 500 karakter'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Format email tidak valid',
      'any.required': 'Email wajib diisi'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password minimal 6 karakter',
      'any.required': 'Password wajib diisi'
    }),
  
  picture: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'URL gambar tidak valid'
    })
});

// Validation schema for updating member
const updateMemberSchema = Joi.object({
  full_name: Joi.string()
    .min(2)
    .max(150)
    .optional()
    .messages({
      'string.min': 'Nama lengkap minimal 2 karakter',
      'string.max': 'Nama lengkap maksimal 150 karakter'
    }),
  
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .optional()
    .messages({
      'string.alphanum': 'Username hanya boleh berisi huruf dan angka',
      'string.min': 'Username minimal 3 karakter',
      'string.max': 'Username maksimal 50 karakter'
    }),
  
  phone_number: Joi.string()
    .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Format nomor telepon tidak valid'
    }),
  
  dob: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Tanggal lahir tidak boleh lebih dari hari ini'
    }),
  
  address: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Alamat maksimal 500 karakter'
    }),
  
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Format email tidak valid'
    }),
  
  password: Joi.string()
    .min(6)
    .optional()
    .messages({
      'string.min': 'Password minimal 6 karakter'
    }),
  
  picture: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'URL gambar tidak valid'
    }),
  
  status: Joi.string()
    .valid('Registered', 'Active', 'Inactive')
    .optional()
    .messages({
      'any.only': 'Status harus Registered, Active, atau Inactive'
    })
});

// Validation schema for updating member package
const updateMemberPackageSchema = Joi.object({
  remaining_group_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Remaining group session must be a number',
      'number.integer': 'Remaining group session must be an integer',
      'number.min': 'Remaining group session must be at least 0'
    }),
  remaining_semi_private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Remaining semi private session must be a number',
      'number.integer': 'Remaining semi private session must be an integer',
      'number.min': 'Remaining semi private session must be at least 0'
    }),
  remaining_private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Remaining private session must be a number',
      'number.integer': 'Remaining private session must be an integer',
      'number.min': 'Remaining private session must be at least 0'
    }),
  used_group_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Used group session must be a number',
      'number.integer': 'Used group session must be an integer',
      'number.min': 'Used group session must be at least 0'
    }),
  used_semi_private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Used semi private session must be a number',
      'number.integer': 'Used semi private session must be an integer',
      'number.min': 'Used semi private session must be at least 0'
    }),
  used_private_session: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Used private session must be a number',
      'number.integer': 'Used private session must be an integer',
      'number.min': 'Used private session must be at least 0'
    }),
  start_date: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),
  end_date: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.format': 'End date must be in ISO format (YYYY-MM-DD)'
    })
});

// Validation schema for member package ID parameter
const memberPackageIdSchema = Joi.object({
  member_package_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Member package ID must be a valid UUID',
      'any.required': 'Member package ID is required'
    })
});

// Validation schema for query parameters
const getMembersQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1)
    .messages({
      'number.base': 'Halaman harus berupa angka',
      'number.integer': 'Halaman harus berupa bilangan bulat',
      'number.min': 'Halaman minimal 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .messages({
      'number.base': 'Limit harus berupa angka',
      'number.integer': 'Limit harus berupa bilangan bulat',
      'number.min': 'Limit minimal 1',
      'number.max': 'Limit maksimal 100'
    }),
  
  search: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Pencarian maksimal 100 karakter'
    }),
  
  status: Joi.string()
    .valid('Registered', 'Active', 'Inactive')
    .optional()
    .allow('')
    .messages({
      'any.only': 'Status harus Registered, Active, atau Inactive'
    })
});

// Validation schema for member ID parameter
const memberIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'ID member tidak valid',
      'any.required': 'ID member wajib diisi'
    })
});

// Schema untuk My Classes query parameters
const getMyClassesSchema = Joi.object({
    type: Joi.string().valid('upcoming', 'waitlist', 'post', 'cancelled').default('upcoming').messages({
        'string.empty': 'Type parameter is required',
        'any.only': 'Type must be one of: upcoming, waitlist, post, cancelled'
    })
});

// Schema untuk cancel booking parameters
const cancelBookingSchema = Joi.object({
    booking_id: Joi.string().uuid().required().messages({
        'string.empty': 'Booking ID is required',
        'string.uuid': 'Booking ID must be a valid UUID',
        'any.required': 'Booking ID is required'
    })
});

// Schema untuk get booking details parameters
const getBookingDetailsSchema = Joi.object({
    booking_id: Joi.string().uuid().required().messages({
        'string.empty': 'Booking ID is required',
        'string.uuid': 'Booking ID must be a valid UUID',
        'any.required': 'Booking ID is required'
    })
});

module.exports = {
  createMemberSchema,
  updateMemberSchema,
  updateMemberPackageSchema,
  memberPackageIdSchema,
  getMembersQuerySchema,
  memberIdSchema,
  getMyClassesSchema,
  cancelBookingSchema,
  getBookingDetailsSchema
}; 