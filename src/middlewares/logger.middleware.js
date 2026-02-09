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

// Middleware untuk logging
const logger = (req, res, next) => {
    const start = Date.now();

    // Log request masuk dengan format yang lebih rapi
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';

    console.log(`\n\x1b[36m[${timestamp}] ${method} ${url} - IP: ${ip}\x1b[0m`);

    // Override res.end untuk menangkap response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const responseTime = Date.now() - start;
        const consoleLogMessage = formatConsoleLogMessage(req, res, responseTime);
        // Log response dengan format yang berbeda untuk console dan file
        console.log(consoleLogMessage);

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

    next(err);
};

module.exports = {
    logger,
    errorLogger
}; 