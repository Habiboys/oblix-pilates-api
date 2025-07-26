'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing midtrans_pdf_url column
    await queryInterface.addColumn('orders', 'midtrans_pdf_url', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // Rename expire_at to expired_at to match the model
    await queryInterface.renameColumn('orders', 'expire_at', 'expired_at');
  },

  async down(queryInterface, Sequelize) {
    // Remove midtrans_pdf_url column
    await queryInterface.removeColumn('orders', 'midtrans_pdf_url');

    // Rename expired_at back to expire_at
    await queryInterface.renameColumn('orders', 'expired_at', 'expire_at');
  }
};
