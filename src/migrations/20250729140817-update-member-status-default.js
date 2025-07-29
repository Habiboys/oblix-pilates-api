'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Update existing members with status 'active' to 'Registered' if they haven't bought any packages
    await queryInterface.sequelize.query(`
      UPDATE members 
      SET status = 'Registered' 
      WHERE status = 'active' 
      AND id NOT IN (
        SELECT DISTINCT member_id 
        FROM member_packages 
        WHERE member_id IS NOT NULL
      )
    `);

    // Update members who have bought packages to 'Active'
    await queryInterface.sequelize.query(`
      UPDATE members 
      SET status = 'Active' 
      WHERE id IN (
        SELECT DISTINCT member_id 
        FROM member_packages 
        WHERE member_id IS NOT NULL
      )
    `);
  },

  async down (queryInterface, Sequelize) {
    // Revert back to 'active' status
    await queryInterface.sequelize.query(`
      UPDATE members 
      SET status = 'active' 
      WHERE status IN ('Registered', 'Active')
    `);
  }
};
