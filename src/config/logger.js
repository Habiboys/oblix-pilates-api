

// Fungsi untuk format timestamp
const formatTimestamp = () => {
    return new Date().toISOString();
};



// Logger utility
const logger = {
    info: (message, data = null) => {
        console.log(`\x1b[36m[INFO]\x1b[0m ${message}`, data ? data : '');
    },

    error: (message, data = null) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`, data ? data : '');
    },

    warn: (message, data = null) => {
        console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`, data ? data : '');
    },

    debug: (message, data = null) => {
        console.log(`\x1b[35m[DEBUG]\x1b[0m ${message}`, data ? data : '');
    }
};

module.exports = logger; 