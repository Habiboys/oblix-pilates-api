const fs = require('fs');
const path = require('path');

// Fungsi untuk format timestamp
const formatTimestamp = () => {
    return new Date().toISOString();
};

// Fungsi untuk menulis log ke file
const writeToLogFile = (level, message, data = null) => {
    const logDir = path.join(__dirname, '../../logs');
    const logFile = path.join(logDir, `api-${new Date().toISOString().split('T')[0]}.log`);
    
    // Buat direktori logs jika belum ada
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    let logMessage = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}`;
    if (data) {
        logMessage += ` - Data: ${JSON.stringify(data)}`;
    }
    
    // Tulis log ke file
    fs.appendFileSync(logFile, logMessage + '\n');
};

// Logger utility
const logger = {
    info: (message, data = null) => {
        console.log(`\x1b[36m[INFO]\x1b[0m ${message}`, data ? data : '');
        writeToLogFile('info', message, data);
    },
    
    error: (message, data = null) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`, data ? data : '');
        writeToLogFile('error', message, data);
    },
    
    warn: (message, data = null) => {
        console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`, data ? data : '');
        writeToLogFile('warn', message, data);
    },
    
    debug: (message, data = null) => {
        console.log(`\x1b[35m[DEBUG]\x1b[0m ${message}`, data ? data : '');
        writeToLogFile('debug', message, data);
    }
};

module.exports = logger; 