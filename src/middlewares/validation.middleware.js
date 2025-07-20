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
                dataToValidate = req.body;
                break;
        }
        
        const { error } = schema.validate(dataToValidate);
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }
        next();
    };
};

module.exports = { validate };