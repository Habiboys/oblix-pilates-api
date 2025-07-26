const fs = require('fs');
const path = require('path');

// Fungsi untuk format timestamp
const formatTimestamp = () => {
    return new Date().toISOString();
};

// Fungsi untuk format log message untuk console (dengan color)
const formatConsoleLogMessage = (req, res, responseTime) => {
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    const contentLength = res.get('Content-Length') || 0;
    
    // Color coding untuk status code
    let statusColor = '';
    if (statusCode >= 200 && statusCode < 300) statusColor = '\x1b[32m'; // Green
    else if (statusCode >= 400 && statusCode < 500) statusColor = '\x1b[33m'; // Yellow
    else if (statusCode >= 500) statusColor = '\x1b[31m'; // Red
    else statusColor = '\x1b[36m'; // Cyan
    
    const resetColor = '\x1b[0m';
    
    return `${statusColor}[${timestamp}] ${method} ${url} - ${statusCode} - ${responseTime}ms - IP: ${ip} - Size: ${contentLength} bytes${resetColor}`;
};

// Fungsi untuk format log message untuk file (tanpa color)
const formatFileLogMessage = (req, res, responseTime) => {
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    const contentLength = res.get('Content-Length') || 0;
    
    return `[${timestamp}] ${method} ${url} - ${statusCode} - ${responseTime}ms - IP: ${ip} - Size: ${contentLength} bytes`;
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
    
    // Log request masuk dengan format yang lebih rapi
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    
    console.log(`\n\x1b[36m[${timestamp}] ${method} ${url} - IP: ${ip}\x1b[0m`);
    writeToLogFile(`[${timestamp}] REQUEST: ${method} ${url} - IP: ${ip}`);
    
    // Log request body jika ada (kecuali untuk file upload) - hanya di file log
    if (req.body && Object.keys(req.body).length > 0 && !req.file) {
        const bodyLog = `[${timestamp}] REQUEST BODY: ${JSON.stringify(req.body)}`;
        writeToLogFile(bodyLog);
    }
    
    // Log query parameters jika ada - hanya di file log
    if (req.query && Object.keys(req.query).length > 0) {
        const queryLog = `[${timestamp}] QUERY PARAMS: ${JSON.stringify(req.query)}`;
        writeToLogFile(queryLog);
    }
    
    // Log headers yang penting - hanya di file log
    const importantHeaders = {
        'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'None',
        'content-type': req.headers['content-type'] || 'None',
        'user-agent': req.headers['user-agent'] || 'None'
    };
    const headersLog = `[${timestamp}] HEADERS: ${JSON.stringify(importantHeaders)}`;
    writeToLogFile(headersLog);
    
    // Override res.end untuk menangkap response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const responseTime = Date.now() - start;
        const consoleLogMessage = formatConsoleLogMessage(req, res, responseTime);
        const fileLogMessage = formatFileLogMessage(req, res, responseTime);
        
        // Log response dengan format yang berbeda untuk console dan file
        console.log(consoleLogMessage);
        writeToLogFile(fileLogMessage);
        
        // Log response body jika ada (untuk semua kasus) - hanya di file log
        if (chunk) {
            try {
                const responseBody = chunk.toString();
                const responseLog = `[${formatTimestamp()}] RESPONSE BODY: ${responseBody}`;
                writeToLogFile(responseLog);
            } catch (error) {
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