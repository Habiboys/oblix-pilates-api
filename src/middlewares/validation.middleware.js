const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        let dataToValidate;
        
        switch (source) {
            case 'params':
                dataToValidate = req.params;
                break;
            case 'query':
                dataToValidate = req.query;
                break;
            case 'body':
            default:
                // Handle multipart/form-data
                if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
                    // Untuk multipart/form-data, gunakan req.body yang sudah diproses oleh multer
                    dataToValidate = req.body || {};
                } else {
                    dataToValidate = req.body;
                }
                break;
        }
        
        const { error } = schema.validate(dataToValidate, { 
            abortEarly: false,
            allowUnknown: true // Izinkan field yang tidak ada di schema
        });
        
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }
        next();
    };
};

module.exports = { validate };