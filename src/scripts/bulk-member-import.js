// src/scripts/bulk-member-import.js
// Script untuk import member secara bulk dan kirim email pemberitahuan

const { User, Member } = require('../models');
const bcrypt = require('bcryptjs');
const emailService = require('../services/email.service');
const { generateMemberCode } = require('../utils/memberUtils');
const logger = require('../config/logger');
require('dotenv').config();

// Data member yang akan diimport (hard coded dari gambar)
const membersData = [


  {
    "full_name": "Ms Tuty",
    "email": "cuanwie@gmail.com",
    "phone_number": "+6288115300010",
    "username": "mstuty"
  },
  {
    "full_name": "Juli",
    "email": "henny.mul@gmail.com",
    "phone_number": "+6282183836363",
    "username": "juli"
  },
  {
    "full_name": "Ms Henny mulyadi",
    "email": "henny3672@gmail.com",
    "phone_number": "+6287881078130",
    "username": "mshennymulyadi"
  },
  {
    "full_name": "Ms Chintya",
    "email": "cynthiaprayitno@icloud.com",
    "phone_number": "+6281611019999",
    "username": "mschintya"
  },
  {
    "full_name": "Ms Vivian",
    "email": "Vivianncen@gmail.com",
    "phone_number": "+6285159775467",
    "username": "msvivian"
  },
  {
    "full_name": "Ms Natasya",
    "email": "Natasyaaaa19@gmail.com",
    "phone_number": "+6285685350777",
    "username": "msnatasya"
  },
  {
    "full_name": "Ms Jenifer",
    "email": "jennismemories@gmail.com",
    "phone_number": "+6288210651657",
    "username": "msjenifer"
  },
  {
    "full_name": "Ms Jessica",
    "email": "jennkezia@gmail.com",
    "phone_number": "+6288210651656",
    "username": "msjessica"
  }
    // {
    //     "full_name": "Khalied Maturino",
    //     "email": "khalidmaturino@gmail.com",
    //     "phone_number": "+6281334567892",
    //     "username": "khaliedmaturino"
    // }
      
            // {
            //   "full_name": "Ms Yunnie",
            //   "email": "juliana627@yahooo.com",
            //   "phone_number": "+6281219931122",
            //   "username": "msyunnie"
            // },
            // {
            //   "full_name": "Ms Evie",
            //   "email": "eviespp@gmail.com",
            //   "phone_number": "+6281618095449",
            //   "username": "msevie"
            // },
            // {
            //   "full_name": "Ms Nelly",
            //   "email": "nellyathien@gmail.com",
            //   "phone_number": "+6281213367789",
            //   "username": "msnelly"
            // },
            // {
            //   "full_name": "Ms Ale",
            //   "email": "alepang447@gmail.com",
            //   "phone_number": "+6281210367225",
            //   "username": "msale"
            // },
            // {
            //   "full_name": "Ms Yuli Widjaya",
            //   "email": "juliewid@yahoo.com",
            //   "phone_number": "+6281280689688",
            //   "username": "msyuliwidjaya"
            // },
            // {
            //   "full_name": "Ms Inge",
            //   "email": "cnc_sweet@yahoo.com",
            //   "phone_number": "+6282123500066",
            //   "username": "msinge"
            // },
            // {
            //   "full_name": "Ms Anatasia",
            //   "email": "chellainte@yahoo.com",
            //   "phone_number": "+62818900061",
            //   "username": "msanatasia"
            // },
            // {
            //   "full_name": "Ms Liana GMS",
            //   "email": "Ijuwita66@yahoo.com",
            //   "phone_number": "+6281808641888",
            //   "username": "mslianagms"
            // },
            // {
            //   "full_name": "Ms Goh Wei Ching",
            //   "email": "goh_weiching@yahoo.com",
            //   "phone_number": "+62818188505",
            //   "username": "msgohweiching"
            // },
            // {
            //   "full_name": "Mr Rico",
            //   "email": "federicofidelsalim2@gmail.com",
            //   "phone_number": "+6281211155527",
            //   "username": "mrrico"
            // },
            // {
            //   "full_name": "Ms Angelina",
            //   "email": "nzzzel@yahoo.com",
            //   "phone_number": "+62812117770000",
            //   "username": "msangelina"
            // },
            // {
            //   "full_name": "Ms Cecilia Vania",
            //   "email": "cvabigail@gmail.com",
            //   "phone_number": "+62816777714",
            //   "username": "msceciliavania"
            // },
            // {
            //   "full_name": "Ms Veni",
            //   "email": "veniliong@gmail.com",
            //   "phone_number": "+62818822261",
            //   "username": "msveni"
            // },
            // {
            //   "full_name": "Ms Sumi",
            //   "email": "sumicst8@gmail.com",
            //   "phone_number": "+6281288998398",
            //   "username": "mssumi"
            // },
            // {
            //   "full_name": "Ms Edeline",
            //   "email": "edeline.rudy@gmail.com",
            //   "phone_number": "+6281398887770",
            //   "username": "msedeline"
            // },
            // {
            //   "full_name": "Ms Ching Ching",
            //   "email": "ching1905@yahoo.com.sg",
            //   "phone_number": "+6281908118188",
            //   "username": "mschingching"
            // },
            // {
            //   "full_name": "Ms Yuri",
            //   "email": "yuri.lian@yahoo.com",
            //   "phone_number": "+6287878199799",
            //   "username": "msyuri"
            // },
            // {
            //   "full_name": "Ms Shiu Ching",
            //   "email": "chingsiehsiu@gmail.com",
            //   "phone_number": "+6287880187457",
            //   "username": "msshuching"
            // },
            // {
            //   "full_name": "Ms Tania tan",
            //   "email": "taniahagy@gmail.com",
            //   "phone_number": "+6281290027771",
            //   "username": "mstaniatan"
            // },
            // {
            //   "full_name": "Ms Jusi Tze",
            //   "email": "jusitze83@gmail.com",
            //   "phone_number": "+6281364998998",
            //   "username": "msjusitze"
            // },
            // {
            //   "full_name": "Ms Chink - chink",
            //   "email": "ch1nkch1nk789@gmail.com",
            //   "phone_number": "+6281574055071",
            //   "username": "mschinkchink"
            // },
            // {
            //   "full_name": "Ms Siska Wei",
            //   "email": "wcy1244167247@gmail.com",
            //   "phone_number": "+6281224849996",
            //   "username": "mssiskawei"
            // },
            // {
            //   "full_name": "Ms Monica benedick",
            //   "email": "monicabenedick2@gmail.com",
            //   "phone_number": "+6281311538601",
            //   "username": "msmonicabenedick"
            // },
            // {
            //   "full_name": "Ms Hanny",
            //   "email": "hannytaufik@gmail.com",
            //   "phone_number": "+6289635993652",
            //   "username": "mshanny"
            // },
            // {
            //   "full_name": "Ms Claresta",
            //   "email": "clarestasia@gmail.com",
            //   "phone_number": "+61452211369",
            //   "username": "msclaresta"
            // },
            // {
            //   "full_name": "Ms Alui",
            //   "email": "halimahamin62@gmail.com",
            //   "phone_number": "+6282210600028",
            //   "username": "msalui"
            // },
            // {
            //   "full_name": "Ms Lidia Lyana",
            //   "email": "lynakez79@gmail.com",
            //   "phone_number": "+628128091009",
            //   "username": "mslidialy yana"
            // },
            // {
            //   "full_name": "Ms Meilany Tan",
            //   "email": "meilanytan10@gmail.com",
            //   "phone_number": "+6283871785858",
            //   "username": "msmeilanytan"
            // },
            // {
            //   "full_name": "Ms Cendy",
            //   "email": "csoegandha@yahoo.com",
            //   "phone_number": "+62818165566",
            //   "username": "mscentdy"
            // },
            // {
            //   "full_name": "Ms Monica Vou",
            //   "email": "mond81700@gmail.com",
            //   "phone_number": "+62811956185858",
            //   "username": "msmonicavou"
            // },
          
            // {
            //   "full_name": "Ms Anna Laksmi",
            //   "email": "laksmi_anna@hotmail.com",
            //   "phone_number": "+6281707022200",
            //   "username": "msannalaksmi"
            // },
            // {
            //   "full_name": "Mr Benny",
            //   "email": "bennydwipurwanta@gmail.com",
            //   "phone_number": "+62811851305",
            //   "username": "mrbenny"
            // },
            // {
            //   "full_name": "Ms Sisca",
            //   "email": "sisca.afung@gmail.com",
            //   "phone_number": "+6287813041982",
            //   "username": "mssisca"
            // },
            // {
            //   "full_name": "Ms Sharine",
            //   "email": "sharines89@gmail.com",
            //   "phone_number": "+6281580679979",
            //   "username": "mssharine"
            // },
     
            // {
            //   "full_name": "Ms Lusia",
            //   "email": "adriel.lusia@gmail.com",
            //   "phone_number": "+62816926400",
            //   "username": "mslusia"
            // },
            // {
            //   "full_name": "Ms Vera",
            //   "email": "veraapandi@gmail.com",
            //   "phone_number": "+62811922376",
            //   "username": "msvera"
            // },
            // {
            //   "full_name": "Ms Lily H",
            //   "email": "lee_potter178@yahoo.com",
            //   "phone_number": "+6287883072990",
            //   "username": "mslilyh"
            // },
            // {
            //   "full_name": "Ms Christin",
            //   "email": "qtin9999@gmail.com",
            //   "phone_number": "+6281119211115",
            //   "username": "mschristin"
            // },
            // {
            //   "full_name": "Ms Yulianti",
            //   "email": "yuli_porianto@yahoo.com",
            //   "phone_number": "+6285921186582",
            //   "username": "msyulianti"
            // },
            // {
            //   "full_name": "Mr Rizki",
            //   "email": "rizkipurnadi@gmail.com",
            //   "phone_number": "+62855983000000",
            //   "username": "mrrizki"
            // },
            // {
            //   "full_name": "Mr Hexa",
            //   "email": "jazzonovas@gmail.com",
            //   "phone_number": "+6281280813000",
            //   "username": "mrhexa"
            // },
            // {
            //   "full_name": "Ms Steffi",
            //   "email": "steffirahardjo17@gmail.com",
            //   "phone_number": "+6281284588728",
            //   "username": "mssteffi"
            // },
            // {
            //   "full_name": "Ms Harjati",
            //   "email": "h_jachja@hotmail.com",
            //   "phone_number": "+6288908891918",
            //   "username": "msharjati"
            // },
            // {
            //   "full_name": "Ms Linda Kriss",
            //   "email": "lindakris931966@gmail.com",
            //   "phone_number": "+6287877613777",
            //   "username": "mslindakriss"
            // },
            // {
            //   "full_name": "Ms Conny",
            //   "email": "connyandriani@gmail.com",
            //   "phone_number": "+6281187765555",
            //   "username": "msconny"
            // },
        
          
            // {
            //   "full_name": "Ms Roselina",
            //   "email": "roslinamgm@yahoo.com",
            //   "phone_number": "+6283892036301",
            //   "username": "msroselina"
            // },
            // {
            //   "full_name": "Ms Diana Bahari",
            //   "email": "diana@rst-indonesia.com",
            //   "phone_number": "+6281280166886",
            //   "username": "msdianabahari"
            // }
          
      
];

/**
 * Generate member code dengan format MBR + YY + 4-digit sequence
 */
const generateMemberCodeWithYear = async () => {
    const prefix = 'MBR';
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Get the latest member code for this year
    const latestMember = await Member.findOne({
        where: {
            member_code: {
                [require('sequelize').Op.like]: `${prefix}${currentYear}%`
            }
        },
        order: [['member_code', 'DESC']]
    });

    let sequence = 1;
    
    if (latestMember && latestMember.member_code) {
        // Extract sequence number from existing code
        const existingSequence = parseInt(latestMember.member_code.slice(-4));
        sequence = existingSequence + 1;
    }

    // Format: MBR + YY + 4-digit sequence (e.g., MBR240001)
    const memberCode = `${prefix}${currentYear}${sequence.toString().padStart(4, '0')}`;
    
    return memberCode;
};

/**
 * Create user and member
 */
const createUserAndMember = async (memberData) => {
    try {
        const { full_name, email, phone_number, username } = memberData;
        
        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            logger.warn(`Email ${email} already exists, skipping...`);
            return { success: false, message: 'Email already exists', email };
        }

        // Check if username already exists
        const existingMember = await Member.findOne({ where: { username } });
        if (existingMember) {
            logger.warn(`Username ${username} already exists, skipping...`);
            return { success: false, message: 'Username already exists', email };
        }

        // Generate member code
        const memberCode = await generateMemberCodeWithYear();
        
        // Hash password (default: phone number) - convert to +62 format without strip
        let defaultPassword = phone_number;
        
        // Convert phone number to +62 format without strip
        if (defaultPassword.startsWith('0')) {
            defaultPassword = '+62' + defaultPassword.substring(1);
        } else if (defaultPassword.startsWith('62')) {
            defaultPassword = '+' + defaultPassword;
        } else if (!defaultPassword.startsWith('+62')) {
            defaultPassword = '+62' + defaultPassword.replace(/[^0-9]/g, '');
        }
        
        // Remove any remaining non-numeric characters except +
        defaultPassword = defaultPassword.replace(/[^+0-9]/g, '');
        
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            role: 'user',
            refresh_token: null
        });

        // Create member
        const member = await Member.create({
            user_id: user.id,
            member_code: memberCode,
            username,
            full_name,
            phone_number,
            dob: new Date('1990-01-01'), // Default DOB, bisa diupdate nanti
            address: '',
            date_of_join: new Date(),
            picture: null,
            status: 'Registered'
        });

        logger.info(`✅ Created user and member for ${email} with member code: ${memberCode}`);
        
        return { 
            success: true, 
            user_id: user.id, 
            member_id: member.id, 
            member_code: memberCode,
            email 
        };
    } catch (error) {
        logger.error(`❌ Error creating user and member for ${memberData.email}:`, error);
        return { success: false, message: error.message, email: memberData.email };
    }
};

/**
 * Send welcome email with login credentials
 */
const sendWelcomeEmail = async (memberData, memberCode) => {
    try {
        const { full_name, email, phone_number } = memberData;
        
        await emailService.sendLoginInfoEmail(email, full_name, phone_number, memberCode);

        logger.info(`✅ Welcome email sent to ${email}`);
        return { success: true, email };
    } catch (error) {
        logger.error(`❌ Error sending welcome email to ${memberData.email}:`, error);
        return { success: false, message: error.message, email: memberData.email };
    }
};

/**
 * Main function to process bulk import
 */
const processBulkImport = async () => {
    try {
        logger.info('🚀 Starting bulk member import...');
        logger.info(`📊 Total members to process: ${membersData.length}`);

        const results = {
            total: membersData.length,
            success: 0,
            failed: 0,
            skipped: 0,
            details: []
        };

        for (let i = 0; i < membersData.length; i++) {
            const memberData = membersData[i];
            logger.info(`\n📝 Processing ${i + 1}/${membersData.length}: ${memberData.email}`);

            // Create user and member
            const createResult = await createUserAndMember(memberData);
            
            if (createResult.success) {
                // Send welcome email
                const emailResult = await sendWelcomeEmail(memberData, createResult.member_code);
                
                if (emailResult.success) {
                    results.success++;
                    results.details.push({
                        email: memberData.email,
                        status: 'SUCCESS',
                        member_code: createResult.member_code,
                        message: 'User created and email sent'
                    });
                } else {
                    results.success++; // User created but email failed
                    results.details.push({
                        email: memberData.email,
                        status: 'PARTIAL_SUCCESS',
                        member_code: createResult.member_code,
                        message: 'User created but email failed: ' + emailResult.message
                    });
                }
            } else {
                if (createResult.message.includes('already exists')) {
                    results.skipped++;
                    results.details.push({
                        email: memberData.email,
                        status: 'SKIPPED',
                        message: createResult.message
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        email: memberData.email,
                        status: 'FAILED',
                        message: createResult.message
                    });
                }
            }

            // Add delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Print summary
        logger.info('\n📈 IMPORT SUMMARY:');
        logger.info(`✅ Success: ${results.success}`);
        logger.info(`❌ Failed: ${results.failed}`);
        logger.info(`⏭️ Skipped: ${results.skipped}`);
        logger.info(`📊 Total: ${results.total}`);

        // Print detailed results
        logger.info('\n📋 DETAILED RESULTS:');
        results.details.forEach((detail, index) => {
            const statusIcon = detail.status === 'SUCCESS' ? '✅' : 
                              detail.status === 'PARTIAL_SUCCESS' ? '⚠️' : 
                              detail.status === 'SKIPPED' ? '⏭️' : '❌';
            logger.info(`${statusIcon} ${index + 1}. ${detail.email} - ${detail.status}: ${detail.message}`);
        });

        return results;

    } catch (error) {
        logger.error('❌ Error in bulk import process:', error);
        throw error;
    }
};

/**
 * Function to read data from CSV file (optional)
 */
const readFromCSV = (filePath) => {
    // Implementasi membaca dari CSV jika diperlukan
    // Bisa menggunakan library seperti 'csv-parser'
    logger.info('CSV reading functionality not implemented yet');
    return [];
};

// Export functions for use in other scripts
module.exports = {
    processBulkImport,
    createUserAndMember,
    sendWelcomeEmail,
    readFromCSV
};

// Run the script if called directly
if (require.main === module) {
    // Check if membersData is empty
    if (membersData.length === 0) {
        logger.error('❌ No member data found. Please add data to membersData array.');
        logger.info('📝 Example format:');
        logger.info(`{
    full_name: "John Doe",
    email: "john@example.com", 
    phone_number: "081234567890",
    username: "johndoe"
}`);
        process.exit(1);
    }

    processBulkImport()
        .then(results => {
            logger.info('🎉 Bulk import completed!');
            process.exit(0);
        })
        .catch(error => {
            logger.error('💥 Bulk import failed:', error);
            process.exit(1);
        });
} 