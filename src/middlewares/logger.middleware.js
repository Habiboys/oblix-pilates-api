const fs = require('fs');
const path = require('path');

// Fungsi untuk format timestamp
const formatTimestamp = () => {
    return new Date().toISOString();
};

// Fungsi untuk format log message
const formatLogMessage = (req, res, responseTime) => {
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    const contentLength = res.get('Content-Length') || 0;
    
    return `[${timestamp}] ${method} ${url} - ${statusCode} - ${responseTime}ms - IP: ${ip} - UA: ${userAgent} - Size: ${contentLength} bytes`;
};

// Fungsi untuk menulis log ke file
const writeToLogFile = (message) => {
    const logDir = path.join(__dirname, '../../logs');
    const logFile = path.join(logDir, `api-${new Date().toISOString().split('T')[0]}.log`);
    
    // Buat direktori logs jika belum ada
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Tulis log ke file
    fs.appendFileSync(logFile, message + '\n');
};

// Middleware untuk logging
const logger = (req, res, next) => {
    const start = Date.now();
    
    // Log request masuk
    const requestLog = `[${formatTimestamp()}] REQUEST: ${req.method} ${req.originalUrl || req.url} - IP: ${req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown'}`;
    console.log(requestLog);
    writeToLogFile(requestLog);
    
    // Log request body jika ada (kecuali untuk file upload)
    if (req.body && Object.keys(req.body).length > 0 && !req.file) {
        const bodyLog = `[${formatTimestamp()}] REQUEST BODY: ${JSON.stringify(req.body)}`;
        console.log(bodyLog);
        writeToLogFile(bodyLog);
    }
    
    // Log query parameters jika ada
    if (req.query && Object.keys(req.query).length > 0) {
        const queryLog = `[${formatTimestamp()}] QUERY PARAMS: ${JSON.stringify(req.query)}`;
        console.log(queryLog);
        writeToLogFile(queryLog);
    }
    
    // Log headers yang penting
    const importantHeaders = {
        'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'None',
        'content-type': req.headers['content-type'] || 'None',
        'user-agent': req.headers['user-agent'] || 'None'
    };
    const headersLog = `[${formatTimestamp()}] HEADERS: ${JSON.stringify(importantHeaders)}`;
    console.log(headersLog);
    writeToLogFile(headersLog);
    
    // Override res.end untuk menangkap response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const responseTime = Date.now() - start;
        const logMessage = formatLogMessage(req, res, responseTime);
        
        // Log response
        console.log(logMessage);
        writeToLogFile(logMessage);
        
        // Log response body jika ada (untuk error cases)
        if (chunk && res.statusCode >= 400) {
            try {
                const responseBody = chunk.toString();
                const responseLog = `[${formatTimestamp()}] RESPONSE BODY: ${responseBody}`;
                console.log(responseLog);
                writeToLogFile(responseLog);
            } catch (error) {
                console.log(`[${formatTimestamp()}] RESPONSE BODY: [Could not parse response body]`);
                writeToLogFile(`[${formatTimestamp()}] RESPONSE BODY: [Could not parse response body]`);
            }
        }
        
        // Panggil original end
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

// Middleware untuk error logging
const errorLogger = (err, req, res, next) => {
    const timestamp = formatTimestamp();
    const errorLog = `[${timestamp}] ERROR: ${err.message} - Stack: ${err.stack} - URL: ${req.originalUrl || req.url} - Method: ${req.method}`;
    
    console.error(errorLog);
    writeToLogFile(errorLog);
    
    next(err);
};

module.exports = {
    logger,
    errorLogger
}; 