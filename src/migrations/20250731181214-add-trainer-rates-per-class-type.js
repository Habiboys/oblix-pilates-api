'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainers', 'rate_group_class', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Group Class (dalam rupiah)'
    });

    await queryInterface.addColumn('trainers', 'rate_semi_private_class', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Semi-Private Class (dalam rupiah)'
    });

    await queryInterface.addColumn('trainers', 'rate_private_class', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Private Class (dalam rupiah)'
    });

    // Update existing trainers dengan rate default
    await queryInterface.sequelize.query(`
      UPDATE trainers 
      SET 
        rate_group_class = 250000,
        rate_semi_private_class = 250000,
        rate_private_class = 275000
      WHERE title IN ('Coach Moredy', 'Coach Lauren', 'Coach Winny')
    `);

    // Update trainer lain dengan rate default yang sama
    await queryInterface.sequelize.query(`
      UPDATE trainers 
      SET 
        rate_group_class = COALESCE(rate_per_class, 250000),
        rate_semi_private_class = COALESCE(rate_per_class, 250000),
        rate_private_class = COALESCE(rate_per_class, 275000)
      WHERE title NOT IN ('Coach Moredy', 'Coach Lauren', 'Coach Winny')
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('trainers', 'rate_group_class');
    await queryInterface.removeColumn('trainers', 'rate_semi_private_class');
    await queryInterface.removeColumn('trainers', 'rate_private_class');
  }
};
