'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to generate dates for the month
    const generateSchedules = () => {
      const schedules = [];
      const now = new Date();
      
      // Class IDs from demo-class.js
      const classIds = [
        '660e8400-e29b-41d4-a716-446655440001', // Beginner Pilates
        '660e8400-e29b-41d4-a716-446655440002', // Intermediate Pilates
        '660e8400-e29b-41d4-a716-446655440003', // Advanced Pilates
        '660e8400-e29b-41d4-a716-446655440004', // Prenatal Pilates
        '660e8400-e29b-41d4-a716-446655440005'  // Postnatal Pilates
      ];
      
      // Trainer IDs from demo-trainer.js
      const trainerIds = [
        '770e8400-e29b-41d4-a716-446655440001', // Coach Lauren
        '770e8400-e29b-41d4-a716-446655440002'  // Coach Sarah
      ];
      
      // Member IDs from demo-user.js
      const memberIds = [
        '880e8400-e29b-41d4-a716-446655440001', // Admin member
        '880e8400-e29b-41d4-a716-446655440002'  // Regular member
      ];
      
      // Generate schedules for July 2025
      for (let day = 1; day <= 31; day++) {
        const date = new Date(2025, 6, day); // July is month 6 (0-indexed)
        const dateStr = date.toISOString().split('T')[0];
        
        // Skip weekends for some variety
        const dayOfWeek = date.getDay();
        
        // Morning Group Classes (Monday-Friday)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          schedules.push({
            id: `schedule-${day}-morning-group`,
            class_id: classIds[day % classIds.length],
            trainer_id: trainerIds[0], // Coach Lauren
            pax: 10,
            type: 'group',
            date_start: dateStr,
            time_start: '07:30',
            time_end: '08:30',
            repeat_type: 'none',
            schedule_until: null,
            booking_deadline_hour: 2,
            waitlist_lock_minutes: 30,
            min_signup: 3,
            cancel_buffer_minutes: 60,
            parent_schedule_id: null,
            member_id: null,
            picture: null,
            createdAt: now,
            updatedAt: now
          });
          
          // Evening Group Classes
          schedules.push({
            id: `schedule-${day}-evening-group`,
            class_id: classIds[(day + 1) % classIds.length],
            trainer_id: trainerIds[1], // Coach Sarah
            pax: 12,
            type: 'group',
            date_start: dateStr,
            time_start: '18:00',
            time_end: '19:00',
            repeat_type: 'none',
            schedule_until: null,
            booking_deadline_hour: 2,
            waitlist_lock_minutes: 30,
            min_signup: 3,
            cancel_buffer_minutes: 60,
            parent_schedule_id: null,
            member_id: null,
            picture: null,
            createdAt: now,
            updatedAt: now
          });
        }
        
        // Semi-Private Classes (Tuesday, Thursday, Saturday)
        if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) {
          schedules.push({
            id: `schedule-${day}-semiprivate`,
            class_id: classIds[(day + 2) % classIds.length],
            trainer_id: trainerIds[day % trainerIds.length],
            pax: 4,
            type: 'semi_private',
            date_start: dateStr,
            time_start: '10:00',
            time_end: '11:00',
            repeat_type: 'none',
            schedule_until: null,
            booking_deadline_hour: 4,
            waitlist_lock_minutes: 60,
            min_signup: 2,
            cancel_buffer_minutes: 120,
            parent_schedule_id: null,
            member_id: null,
            picture: null,
            createdAt: now,
            updatedAt: now
          });
        }
        
        // Private Classes (Wednesday, Friday)
        if (dayOfWeek === 3 || dayOfWeek === 5) {
          schedules.push({
            id: `schedule-${day}-private`,
            class_id: classIds[(day + 3) % classIds.length],
            trainer_id: trainerIds[day % trainerIds.length],
            pax: 1,
            type: 'private',
            date_start: dateStr,
            time_start: '14:00',
            time_end: '15:00',
            repeat_type: 'none',
            schedule_until: null,
            booking_deadline_hour: 6,
            waitlist_lock_minutes: 120,
            min_signup: 1,
            cancel_buffer_minutes: 180,
            parent_schedule_id: null,
            member_id: memberIds[day % memberIds.length], // Assign member for private
            picture: null,
            createdAt: now,
            updatedAt: now
          });
        }
      }
      
      return schedules;
    };
    
    const schedules = generateSchedules();
    await queryInterface.bulkInsert('schedules', schedules, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('schedules', null, {});
  }
}; 