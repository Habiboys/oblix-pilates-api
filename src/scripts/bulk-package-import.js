// src/scripts/bulk-package-import.js
// Script untuk import data paket membership berdasarkan data member yang ada

const db = require('../models');
const { Package, PackageMembership, Category, Member, MemberPackage, Order } = db;
const logger = require('../config/logger');
require('dotenv').config();

// Data paket membership berdasarkan informasi yang diberikan
const packageData = [
    {
        name: "Group Class Membership",
        type: "membership",
        price: 1500000, // Default price, bisa disesuaikan
        duration_value: 3,
        duration_unit: "month",
        session: 12, // Default session count
        category_name: "Group Class"
    },
    {
        name: "Private 1:1 Membership", 
        type: "membership",
        price: 2500000, // Default price, bisa disesuaikan
        duration_value: 3,
        duration_unit: "month",
        session: 8, // Default session count
        category_name: "Private Class"
    }
];

// Data member dengan paket mereka (berdasarkan data yang diberikan)
// Menggunakan email untuk menghindari redundansi nama
const memberPackageData = [
    // Group Class Members - berdasarkan data spreadsheet yang benar
    { member_email: "juliana627@yahooo.com", remaining_group_sessions: 0, remaining_private_sessions: 7 }, // Ms Yunnie: Group habis, Private masih 7
    { member_email: "eviespp@gmail.com", remaining_group_sessions: 0, remaining_private_sessions: 0 }, // Ms Evie: Group kosong
    { member_email: "nellyathien@gmail.com", remaining_group_sessions: 11, remaining_private_sessions: 0 },
    { member_email: "alepang447@gmail.com", remaining_group_sessions: 6, remaining_private_sessions: 0 },
    { member_email: "juliewid@yahoo.com", remaining_group_sessions: 11, remaining_private_sessions: 0 }, // Ms Yuli Widjaya: 11 bukan 13
    { member_email: "cnc_sweet@yahoo.com", remaining_group_sessions: 13, remaining_private_sessions: 0 }, // Ms Inge: 13 bukan 12
    { member_email: "chellainte@yahoo.com", remaining_group_sessions: 12, remaining_private_sessions: 0 }, // Ms Anatasia: 12 bukan 5
    { member_email: "Ijuwita66@yahoo.com", remaining_group_sessions: 5, remaining_private_sessions: 0 }, // Ms Liana GMS: 5 bukan 4
    { member_email: "goh_weiching@yahoo.com", remaining_group_sessions: 4, remaining_private_sessions: 0 }, // Ms Goh Wei Ching: 4 bukan 10
    { member_email: "federicofidelsalim2@gmail.com", remaining_group_sessions: 12, remaining_private_sessions: 0 }, // Mr Rico: 12 bukan 10
    { member_email: "nzzzel@yahoo.com", remaining_group_sessions: 10, remaining_private_sessions: 0 }, // Ms Angelina: 10 bukan 25
    { member_email: "cvabigail@gmail.com", remaining_group_sessions: 13, remaining_private_sessions: 0 }, // Ms Cecilia Vania: 13 bukan 9
    { member_email: "veniliong@gmail.com", remaining_group_sessions: 8, remaining_private_sessions: 0 }, // Ms Veni: 8 bukan 3
    { member_email: "sumicst8@gmail.com", remaining_group_sessions: 8, remaining_private_sessions: 0 }, // Ms Sumi: 8 bukan 38
    { member_email: "edeline.rudy@gmail.com", remaining_group_sessions: 4, remaining_private_sessions: 0 }, // Ms Edeline: 4 bukan 2
    { member_email: "ching1905@yahoo.com.sg", remaining_group_sessions: 40, remaining_private_sessions: 18 }, // Ms Ching Ching: Group 40, Private 18
    { member_email: "yuri.lian@yahoo.com", remaining_group_sessions: 14, remaining_private_sessions: 0 }, // Ms Yuri: 14 bukan 46
    { member_email: "chingsiehsiu@gmail.com", remaining_group_sessions: 8, remaining_private_sessions: 0 }, // Ms Shiu Ching: 8 bukan 17
    { member_email: "taniahagy@gmail.com", remaining_group_sessions: 10, remaining_private_sessions: 0 }, // Ms Tania tan: 10 bukan 8
    { member_email: "jusitze83@gmail.com", remaining_group_sessions: 25, remaining_private_sessions: 0 }, // Ms Jusi Tze: 25 bukan 33
    { member_email: "ch1nkch1nk789@gmail.com", remaining_group_sessions: 9, remaining_private_sessions: 0 }, // Ms Chink - chink: 9 bukan 1
    { member_email: "wcy1244167247@gmail.com", remaining_group_sessions: 6, remaining_private_sessions: 0 }, // Ms Siska Wei: 6 bukan 26
    { member_email: "monicabenedick2@gmail.com", remaining_group_sessions: 3, remaining_private_sessions: 0 }, // Ms Monica benedick: 3 bukan 32
    { member_email: "hannytaufik@gmail.com", remaining_group_sessions: 38, remaining_private_sessions: 0 }, // Ms Hanny: 38 bukan 34
    { member_email: "clarestasia@gmail.com", remaining_group_sessions: 999, remaining_private_sessions: 0 }, // Ms Claresta: Unlimited 3 bulan (set 999)
    { member_email: "halimahamin62@gmail.com", remaining_group_sessions: 8, remaining_private_sessions: 0 }, // Ms Alui: 8 bukan 11
    { member_email: "lynakez79@gmail.com", remaining_group_sessions: 8, remaining_private_sessions: 0 }, // Ms Lidia Lyana: 8 bukan 6
    { member_email: "meilanytan10@gmail.com", remaining_group_sessions: 13, remaining_private_sessions: 0 }, // Ms Meilany Tan: 13 bukan 2
    { member_email: "mond81700@gmail.com", remaining_group_sessions: 12, remaining_private_sessions: 0 }, // Ms Monica Vou: 12 bukan 19
    { member_email: "laksmi_anna@hotmail.com", remaining_group_sessions: 12, remaining_private_sessions: 0 }, // Ms Anna Laksmi: 12 bukan 40
    { member_email: "sisca.afung@gmail.com", remaining_group_sessions: 10, remaining_private_sessions: 0 }, // Ms Sisca: 10 bukan 3
    { member_email: "sharines89@gmail.com", remaining_group_sessions: 0, remaining_private_sessions: 4 }, // Ms Sharine: Group kosong, Private 4
    { member_email: "adriel.lusia@gmail.com", remaining_group_sessions: 17, remaining_private_sessions: 0 }, // Ms Lusia: 17 bukan 5
    { member_email: "veraapandi@gmail.com", remaining_group_sessions: 17, remaining_private_sessions: 0 }, // Ms Vera: 17 bukan 10
    { member_email: "lee_potter178@yahoo.com", remaining_group_sessions: 8, remaining_private_sessions: 5 }, // Ms Lily H: Group 8, Private 5
    { member_email: "qtin9999@gmail.com", remaining_group_sessions: 33, remaining_private_sessions: 0 }, // Ms Christin: 33 bukan 40
    { member_email: "yuli_porianto@yahoo.com", remaining_group_sessions: 1, remaining_private_sessions: 0 }, // Ms Yulianti: 1 bukan 3
    { member_email: "rizkipurnadi@gmail.com", remaining_group_sessions: 26, remaining_private_sessions: 0 }, // Mr Rizki: 26
    { member_email: "jazzonovas@gmail.com", remaining_group_sessions: 32, remaining_private_sessions: 0 }, // Mr Hexa: 32
    { member_email: "steffirahardjo17@gmail.com", remaining_group_sessions: 34, remaining_private_sessions: 0 }, // Ms Steffi: 34 bukan 12
    { member_email: "h_jachja@hotmail.com", remaining_group_sessions: 0, remaining_private_sessions: 7 }, // Ms Harjati: Group kosong, Private 7
    { member_email: "lindakris931966@gmail.com", remaining_group_sessions: 11, remaining_private_sessions: 0 }, // Ms Linda Kriss: 11 bukan 10
    { member_email: "connyandriani@gmail.com", remaining_group_sessions: 10, remaining_private_sessions: 0 }, // Ms Conny: 10 bukan 19
    { member_email: "roslinamgm@yahoo.com", remaining_group_sessions: 40, remaining_private_sessions: 0 }, // Ms Roselina: 40
    { member_email: "diana@rst-indonesia.com", remaining_group_sessions: 12, remaining_private_sessions: 0 }, // Ms Diana Bahari: 12 bukan 3
    
    // Member yang belum ada di data sebelumnya
    { member_email: "bennydwipurwanta@gmail.com", remaining_group_sessions: 0, remaining_private_sessions: 2 } // Mr Benny: Private 1:1, 2 sessions
];

/**
 * Create or get category
 */
const getOrCreateCategory = async (categoryName) => {
    try {
        let category = await Category.findOne({ where: { category_name: categoryName } });
        
        if (!category) {
            category = await Category.create({
                category_name: categoryName
            });
            logger.info(`✅ Created category: ${categoryName}`);
        } else {
            logger.info(`📋 Found existing category: ${categoryName}`);
        }
        
        return category;
    } catch (error) {
        logger.error(`❌ Error with category ${categoryName}:`, error);
        throw error;
    }
};

/**
 * Create package and package membership
 */
const createPackageAndMembership = async (packageInfo) => {
    try {
        const { name, type, price, duration_value, duration_unit, session, category_name } = packageInfo;
        
        // Check if package already exists
        const existingPackage = await Package.findOne({ where: { name } });
        if (existingPackage) {
            logger.warn(`📦 Package ${name} already exists, skipping...`);
            return { success: false, message: 'Package already exists', name };
        }

        // Get or create category
        const category = await getOrCreateCategory(category_name);
        
        // Create package
        const package = await Package.create({
            name,
            type,
            price: price || 0,
            duration_value: duration_value || 3,
            duration_unit: duration_unit || 'month',
            reminder_day: 7, // Default reminder 7 days before expiry
            reminder_session: 2 // Default reminder when 2 sessions left
        });

        // Create package membership
        await PackageMembership.create({
            package_id: package.id,
            session,
            category_id: category.id
        });

        logger.info(`✅ Created package: ${name} with ${session} sessions`);
        
        return { 
            success: true, 
            package_id: package.id, 
            name,
            session 
        };
    } catch (error) {
        logger.error(`❌ Error creating package ${packageInfo.name}:`, error);
        return { success: false, message: error.message, name: packageInfo.name };
    }
};

/**
 * Create member package for existing member
 */
const createMemberPackage = async (memberPackageInfo) => {
    try {
        const { member_email, remaining_group_sessions, remaining_private_sessions } = memberPackageInfo;
        
        // Find member by email (lebih aman karena email unik)
        const member = await Member.findOne({ 
            include: [{ 
                model: db.User, 
                where: { email: member_email },
                attributes: ['email'] 
            }]
        });
        
        if (!member) {
            logger.warn(`👤 Member dengan email ${member_email} not found, skipping...`);
            return { success: false, message: 'Member not found', member_email };
        }

        // Find Group Class package
        const groupPackage = await Package.findOne({ 
            where: { name: "Group Class Membership" }
        });
        
        if (!groupPackage) {
            logger.warn(`📦 Group Class Membership package not found, skipping...`);
            return { success: false, message: 'Group Class Membership package not found', member_name };
        }

        // Find Private Class package
        const privatePackage = await Package.findOne({ 
            where: { name: "Private 1:1 Membership" }
        });
        
        if (!privatePackage) {
            logger.warn(`📦 Private 1:1 Membership package not found, skipping...`);
            return { success: false, message: 'Private 1:1 Membership package not found', member_name };
        }

        const results = [];

        // Create Group Class member package if member has group sessions
        if (remaining_group_sessions > 0 || remaining_group_sessions === 0) {
            // Check if member already has group package
            const existingGroupPackage = await MemberPackage.findOne({
                where: { 
                    member_id: member.id,
                    package_id: groupPackage.id
                }
            });
            
            if (!existingGroupPackage) {
                // Calculate used group sessions
                const groupPackageMembership = await PackageMembership.findOne({
                    where: { package_id: groupPackage.id }
                });
                
                const totalGroupSessions = groupPackageMembership ? groupPackageMembership.session : 12;
                const usedGroupSessions = totalGroupSessions - remaining_group_sessions;

                // Create group member package
                const groupMemberPackage = await MemberPackage.create({
                    member_id: member.id,
                    package_id: groupPackage.id,
                    order_id: null,
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date(Date.now() + (3 * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
                    used_group_session: usedGroupSessions,
                    used_private_session: 0,
                    used_semi_private_session: 0,
                    remaining_group_session: remaining_group_sessions,
                    remaining_private_session: 0,
                    remaining_semi_private_session: 0
                });

                logger.info(`✅ Created Group Class package for ${member_email}: ${remaining_group_sessions} sessions remaining`);
                results.push({ type: 'Group Class', success: true, remaining_sessions: remaining_group_sessions });
            } else {
                logger.warn(`📋 Member ${member_email} already has Group Class package, skipping...`);
                results.push({ type: 'Group Class', success: false, message: 'Already exists' });
            }
        }

        // Create Private Class member package if member has private sessions
        if (remaining_private_sessions > 0 || remaining_private_sessions === 0) {
            // Check if member already has private package
            const existingPrivatePackage = await MemberPackage.findOne({
                where: { 
                    member_id: member.id,
                    package_id: privatePackage.id
                }
            });
            
            if (!existingPrivatePackage) {
                // Calculate used private sessions
                const privatePackageMembership = await PackageMembership.findOne({
                    where: { package_id: privatePackage.id }
                });
                
                const totalPrivateSessions = privatePackageMembership ? privatePackageMembership.session : 8;
                const usedPrivateSessions = totalPrivateSessions - remaining_private_sessions;

                // Create private member package
                const privateMemberPackage = await MemberPackage.create({
                    member_id: member.id,
                    package_id: privatePackage.id,
                    order_id: null,
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date(Date.now() + (3 * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
                    used_group_session: 0,
                    used_private_session: usedPrivateSessions,
                    used_semi_private_session: 0,
                    remaining_group_session: 0,
                    remaining_private_session: remaining_private_sessions,
                    remaining_semi_private_session: 0
                });

                logger.info(`✅ Created Private 1:1 package for ${member_email}: ${remaining_private_sessions} sessions remaining`);
                results.push({ type: 'Private 1:1', success: true, remaining_sessions: remaining_private_sessions });
            } else {
                logger.warn(`📋 Member ${member_email} already has Private 1:1 package, skipping...`);
                results.push({ type: 'Private 1:1', success: false, message: 'Already exists' });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        return { 
            success: successCount > 0, 
            member_email,
            results,
            success_count: successCount,
            total_count: totalCount
        };
    } catch (error) {
        logger.error(`❌ Error creating member package for ${memberPackageInfo.member_email}:`, error);
        return { success: false, message: error.message, member_email: memberPackageInfo.member_email };
    }
};

/**
 * Main function to process bulk package import
 */
const processBulkPackageImport = async () => {
    try {
        logger.info('🚀 Starting bulk package import...');
        logger.info(`📦 Total packages to create: ${packageData.length}`);
        logger.info(`👤 Total member packages to create: ${memberPackageData.length}`);

        const results = {
            packages: {
                total: packageData.length,
                success: 0,
                failed: 0,
                details: []
            },
            memberPackages: {
                total: memberPackageData.length,
                success: 0,
                failed: 0,
                skipped: 0,
                details: []
            }
        };

        // Step 1: Create packages
        logger.info('\n📦 STEP 1: Creating packages...');
        for (let i = 0; i < packageData.length; i++) {
            const packageInfo = packageData[i];
            logger.info(`\n📝 Processing package ${i + 1}/${packageData.length}: ${packageInfo.name}`);

            const result = await createPackageAndMembership(packageInfo);
            
            if (result.success) {
                results.packages.success++;
                results.packages.details.push({
                    name: packageInfo.name,
                    status: 'SUCCESS',
                    message: 'Package created successfully'
                });
            } else {
                results.packages.failed++;
                results.packages.details.push({
                    name: packageInfo.name,
                    status: 'FAILED',
                    message: result.message
                });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 2: Create member packages
        logger.info('\n👤 STEP 2: Creating member packages...');
        for (let i = 0; i < memberPackageData.length; i++) {
            const memberPackageInfo = memberPackageData[i];
            logger.info(`\n📝 Processing member package ${i + 1}/${memberPackageData.length}: ${memberPackageInfo.member_email}`);

            const result = await createMemberPackage(memberPackageInfo);
            
            if (result.success) {
                results.memberPackages.success += result.success_count;
                results.memberPackages.skipped += (result.total_count - result.success_count);
                
                result.results.forEach(packageResult => {
                    results.memberPackages.details.push({
                        member_email: memberPackageInfo.member_email,
                        package_type: packageResult.type,
                        status: packageResult.success ? 'SUCCESS' : 'SKIPPED',
                        message: packageResult.success ? 
                            `Member package created successfully (${packageResult.remaining_sessions} sessions remaining)` : 
                            packageResult.message
                    });
                });
            } else if (result.message.includes('not found')) {
                results.memberPackages.skipped++;
                results.memberPackages.details.push({
                    member_email: memberPackageInfo.member_email,
                    package_type: 'N/A',
                    status: 'SKIPPED',
                    message: result.message
                });
            } else {
                results.memberPackages.failed++;
                results.memberPackages.details.push({
                    member_email: memberPackageInfo.member_email,
                    package_type: 'N/A',
                    status: 'FAILED',
                    message: result.message
                });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Print summary
        logger.info('\n📈 IMPORT SUMMARY:');
        logger.info('\n📦 PACKAGES:');
        logger.info(`✅ Success: ${results.packages.success}`);
        logger.info(`❌ Failed: ${results.packages.failed}`);
        logger.info(`📊 Total: ${results.packages.total}`);

        logger.info('\n👤 MEMBER PACKAGES:');
        logger.info(`✅ Success: ${results.memberPackages.success}`);
        logger.info(`❌ Failed: ${results.memberPackages.failed}`);
        logger.info(`⏭️ Skipped: ${results.memberPackages.skipped}`);
        logger.info(`📊 Total: ${results.memberPackages.total}`);

        // Print detailed results
        logger.info('\n📋 DETAILED RESULTS:');
        
        logger.info('\n📦 PACKAGES:');
        results.packages.details.forEach((detail, index) => {
            const statusIcon = detail.status === 'SUCCESS' ? '✅' : '❌';
            logger.info(`${statusIcon} ${index + 1}. ${detail.name} - ${detail.status}: ${detail.message}`);
        });

        logger.info('\n👤 MEMBER PACKAGES:');
        results.memberPackages.details.forEach((detail, index) => {
            const statusIcon = detail.status === 'SUCCESS' ? '✅' : 
                              detail.status === 'SKIPPED' ? '⏭️' : '❌';
            logger.info(`${statusIcon} ${index + 1}. ${detail.member_email} (${detail.package_type}) - ${detail.status}: ${detail.message}`);
        });

        return results;

    } catch (error) {
        logger.error('❌ Error in bulk package import process:', error);
        throw error;
    }
};

// Export functions for use in other scripts
module.exports = {
    processBulkPackageImport,
    createPackageAndMembership,
    createMemberPackage
};

// Run the script if called directly
if (require.main === module) {
    processBulkPackageImport()
        .then(results => {
            logger.info('🎉 Bulk package import completed!');
            process.exit(0);
        })
        .catch(error => {
            logger.error('💥 Bulk package import failed:', error);
            process.exit(1);
        });
} 