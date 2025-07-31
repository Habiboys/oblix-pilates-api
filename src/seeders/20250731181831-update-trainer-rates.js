'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update Coach Moredy, Lauren, dan Winny dengan rate yang sesuai
    await queryInterface.sequelize.query(`
      UPDATE trainers 
      SET 
        rate_group_class = 250000,
        rate_semi_private_class = 250000,
        rate_private_class = 275000
      WHERE title IN ('Coach Moredy', 'Coach Lauren', 'Coach Winny')
    `);

    // Update trainer lain dengan rate default
    await queryInterface.sequelize.query(`
      UPDATE trainers 
      SET 
        rate_group_class = COALESCE(rate_per_class, 250000),
        rate_semi_private_class = COALESCE(rate_per_class, 250000),
        rate_private_class = COALESCE(rate_per_class, 275000)
      WHERE title NOT IN ('Coach Moredy', 'Coach Lauren', 'Coach Winny')
    `);

    console.log('✅ Trainer rates updated successfully');
  },

  async down(queryInterface, Sequelize) {
    // Reset rates ke null
    await queryInterface.sequelize.query(`
      UPDATE trainers 
      SET 
        rate_group_class = NULL,
        rate_semi_private_class = NULL,
        rate_private_class = NULL
    `);

    console.log('✅ Trainer rates reset successfully');
  }
};
