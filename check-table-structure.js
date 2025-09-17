require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkTableStructure() {
    try {
        console.log('Checking orders table structure...');
        
        const [results] = await sequelize.query("DESCRIBE orders");
        console.log('Orders table columns:');
        results.forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });
        
        console.log('\nChecking if created_at column exists...');
        const createdAtColumn = results.find(row => row.Field === 'created_at');
        if (createdAtColumn) {
            console.log('created_at column exists:', createdAtColumn);
        } else {
            console.log('created_at column does NOT exist!');
            console.log('Available timestamp columns:');
            results.filter(row => row.Type.includes('timestamp') || row.Type.includes('datetime')).forEach(row => {
                console.log(`- ${row.Field} (${row.Type})`);
            });
        }
        
    } catch (error) {
        console.error('Error checking table structure:', error);
    } finally {
        process.exit(0);
    }
}

checkTableStructure();
