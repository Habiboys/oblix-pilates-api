'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get existing data for references
    const schedules = await queryInterface.sequelize.query(
      `SELECT id FROM schedules WHERE type IN ('group', 'semi_private') LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const members = await queryInterface.sequelize.query(
      `SELECT id FROM members LIMIT 10`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const packages = await queryInterface.sequelize.query(
      `SELECT id FROM packages LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (schedules.length === 0 || members.length === 0 || packages.length === 0) {
      console.log('❌ Tidak ada data schedules, members, atau packages yang tersedia untuk membuat waitlist bookings');
      return;
    }

    const waitlistBookings = [];

    // Create waitlist bookings for different schedules
    schedules.forEach((schedule, scheduleIndex) => {
      // Add 2-4 waitlist members per schedule
      const numWaitlist = Math.floor(Math.random() * 3) + 2; // 2-4 members
      
      for (let i = 0; i < numWaitlist; i++) {
        const memberIndex = (scheduleIndex * numWaitlist + i) % members.length;
        const packageIndex = Math.floor(Math.random() * packages.length);
        
        waitlistBookings.push({
          id: Sequelize.literal('UUID()'),
          schedule_id: schedule.id,
          member_id: members[memberIndex].id,
          package_id: packages[packageIndex].id,
          status: 'waiting_list',
          attendance: 'present',
          notes: `Waitlist booking #${i + 1} untuk schedule ${scheduleIndex + 1}`,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    // Insert waitlist bookings
    if (waitlistBookings.length > 0) {
      await queryInterface.bulkInsert('bookings', waitlistBookings, {});
      console.log(`✅ Berhasil membuat ${waitlistBookings.length} waitlist bookings`);
    }

    // Also create some signup bookings to make schedules look more realistic
    const signupBookings = [];

    schedules.forEach((schedule, scheduleIndex) => {
      // Add 1-3 signup members per schedule
      const numSignup = Math.floor(Math.random() * 3) + 1; // 1-3 members
      
      for (let i = 0; i < numSignup; i++) {
        const memberIndex = (scheduleIndex * numSignup + i + 5) % members.length; // Use different members
        const packageIndex = Math.floor(Math.random() * packages.length);
        
        signupBookings.push({
          id: Sequelize.literal('UUID()'),
          schedule_id: schedule.id,
          member_id: members[memberIndex].id,
          package_id: packages[packageIndex].id,
          status: 'signup',
          attendance: 'present',
          notes: `Signup booking #${i + 1} untuk schedule ${scheduleIndex + 1}`,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    // Insert signup bookings
    if (signupBookings.length > 0) {
      await queryInterface.bulkInsert('bookings', signupBookings, {});
      console.log(`✅ Berhasil membuat ${signupBookings.length} signup bookings`);
    }

    console.log('🎉 Data dummy waitlist dan signup bookings berhasil dibuat!');
  },

  async down(queryInterface, Sequelize) {
    // Remove all demo bookings
    await queryInterface.bulkDelete('bookings', {
      notes: {
        [Sequelize.Op.like]: '%Waitlist booking%'
      }
    });
    
    await queryInterface.bulkDelete('bookings', {
      notes: {
        [Sequelize.Op.like]: '%Signup booking%'
      }
    });
    
    console.log('🗑️ Demo waitlist dan signup bookings berhasil dihapus');
  }
}; 