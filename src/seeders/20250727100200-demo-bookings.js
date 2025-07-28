'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to generate bookings
    const generateBookings = () => {
      const bookings = [];
      const now = new Date();
      
      // Member IDs from demo-user.js
      const memberIds = [
        '880e8400-e29b-41d4-a716-446655440001', // Admin member
        '880e8400-e29b-41d4-a716-446655440002'  // Regular member
      ];
      
      // Package IDs from demo-packages.js
      const packageIds = [
        '770e8400-e29b-41d4-a716-446655440001', // 30 Session Group
        '770e8400-e29b-41d4-a716-446655440002', // 20 Session Group
        '770e8400-e29b-41d4-a716-446655440003', // 10 Session Group
        '770e8400-e29b-41d4-a716-446655440004', // First Trial Package
        '770e8400-e29b-41d4-a716-446655440005'  // Promo New Year
      ];
      
      // Generate bookings for July 2025
      let bookingCounter = 1;
      
      for (let day = 1; day <= 31; day++) {
        const date = new Date(2025, 6, day);
        const dayOfWeek = date.getDay();
        
        // Morning Group Classes (Monday-Friday) - Add some bookings
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Morning group schedule
          const morningScheduleId = `schedule-${day}-morning-group`;
          
          // Add 3-8 random bookings for morning group classes
          const numBookings = Math.floor(Math.random() * 6) + 3; // 3-8 bookings
          for (let i = 0; i < numBookings; i++) {
            const memberIndex = i % memberIds.length;
            const packageIndex = i % 3; // Use only group packages (first 3)
            
            bookings.push({
              id: `booking-${bookingCounter++}`,
              schedule_id: morningScheduleId,
              member_id: memberIds[memberIndex],
              package_id: packageIds[packageIndex],
              status: 'signup',
              createdAt: now,
              updatedAt: now
            });
          }
          
          // Add 1-2 waiting list bookings sometimes
          if (Math.random() > 0.7) { // 30% chance
            const waitingBookings = Math.floor(Math.random() * 2) + 1; // 1-2 waiting
            for (let i = 0; i < waitingBookings; i++) {
              const memberIndex = i % memberIds.length;
              const packageIndex = i % 3;
              
              bookings.push({
                id: `booking-${bookingCounter++}`,
                schedule_id: morningScheduleId,
                member_id: memberIds[memberIndex],
                package_id: packageIds[packageIndex],
                status: 'waiting_list',
                createdAt: now,
                updatedAt: now
              });
            }
          }
          
          // Evening group schedule
          const eveningScheduleId = `schedule-${day}-evening-group`;
          
          // Add 4-10 bookings for evening group classes (more popular)
          const numEveningBookings = Math.floor(Math.random() * 7) + 4; // 4-10 bookings
          for (let i = 0; i < numEveningBookings; i++) {
            const memberIndex = i % memberIds.length;
            const packageIndex = i % 3;
            
            bookings.push({
              id: `booking-${bookingCounter++}`,
              schedule_id: eveningScheduleId,
              member_id: memberIds[memberIndex],
              package_id: packageIds[packageIndex],
              status: 'signup',
              createdAt: now,
              updatedAt: now
            });
          }
        }
        
        // Semi-Private Classes (Tuesday, Thursday, Saturday)
        if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) {
          const semiPrivateScheduleId = `schedule-${day}-semiprivate`;
          
          // Add 2-3 bookings for semi-private (capacity is 4)
          const numSemiBookings = Math.floor(Math.random() * 2) + 2; // 2-3 bookings
          for (let i = 0; i < numSemiBookings; i++) {
            const memberIndex = i % memberIds.length;
            const packageIndex = i % 3;
            
            bookings.push({
              id: `booking-${bookingCounter++}`,
              schedule_id: semiPrivateScheduleId,
              member_id: memberIds[memberIndex],
              package_id: packageIds[packageIndex],
              status: 'signup',
              createdAt: now,
              updatedAt: now
            });
          }
        }
        
        // Private Classes (Wednesday, Friday) - Auto booked to assigned member
        if (dayOfWeek === 3 || dayOfWeek === 5) {
          const privateScheduleId = `schedule-${day}-private`;
          const assignedMemberIndex = day % memberIds.length;
          
          // Private classes are automatically booked to the assigned member
          bookings.push({
            id: `booking-${bookingCounter++}`,
            schedule_id: privateScheduleId,
            member_id: memberIds[assignedMemberIndex],
            package_id: packageIds[4], // Use promo package for private
            status: 'signup',
            createdAt: now,
            updatedAt: now
          });
        }
        
        // Add some cancelled bookings for realism (5% chance)
        if (Math.random() > 0.95 && dayOfWeek >= 1 && dayOfWeek <= 5) {
          const cancelledScheduleId = `schedule-${day}-morning-group`;
          bookings.push({
            id: `booking-${bookingCounter++}`,
            schedule_id: cancelledScheduleId,
            member_id: memberIds[0],
            package_id: packageIds[0],
            status: 'cancelled',
            createdAt: now,
            updatedAt: now
          });
        }
      }
      
      return bookings;
    };
    
    const bookings = generateBookings();
    await queryInterface.bulkInsert('bookings', bookings, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('bookings', null, {});
  }
}; 