'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         *
         * Example:
         * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
         */

        // Change member_id to allow NULL
        await queryInterface.changeColumn('bookings', 'member_id', {
            type: Sequelize.UUID,
            allowNull: true
        });

        // Change package_id to allow NULL
        await queryInterface.changeColumn('bookings', 'package_id', {
            type: Sequelize.UUID,
            allowNull: true
        });

        // Add guest_name column
        await queryInterface.addColumn('bookings', 'guest_name', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Name for external member/guest'
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        await queryInterface.removeColumn('bookings', 'guest_name');

        // Note: Reverting changeColumn for allowNull: false might fail if null values exist
        // so we typically skip strict revert for dev migrations or handle data cleanup first.
    }
};
