// run-member-import.js
// Script sederhana untuk menjalankan import member

const { processBulkImport } = require('./src/scripts/bulk-member-import');

console.log('🚀 Starting member import process...');
console.log('📧 This will create user accounts and send welcome emails');
console.log('🔐 Default password will be their phone number');
console.log('⚠️ Users will be asked to change password after first login\n');

processBulkImport()
    .then(results => {
        console.log('\n🎉 Import process completed!');
        console.log(`✅ Success: ${results.success}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`⏭️ Skipped: ${results.skipped}`);
        console.log(`📊 Total: ${results.total}`);
        
        if (results.success > 0) {
            console.log('\n📧 Welcome emails have been sent to new users');
            console.log('🔐 They can login with their email and phone number as password');
        }
        
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Import failed:', error);
        process.exit(1);
    }); 