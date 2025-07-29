const Joi = require('joi');


const getMyClassesSchema = Joi.object({
    type: Joi.string().valid('upcoming', 'waitlist', 'post', 'cancelled').default('upcoming').messages({
        'string.empty': 'Type parameter is required',
        'any.only': 'Type must be one of: upcoming, waitlist, post, cancelled'
    })
});



module.exports = {
  getMyClassesSchema,
}; 