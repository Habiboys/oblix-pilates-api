'use strict';

const { generateSlug } = require('../utils/slugUtils');

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Get all existing blogs that don't have slug
      const blogs = await queryInterface.sequelize.query(
        'SELECT id, title FROM blogs WHERE slug IS NULL OR slug = ""',
        { type: Sequelize.QueryTypes.SELECT }
      );

      console.log(`Found ${blogs.length} blogs to update with slug`);

      // Update each blog with generated slug
      for (const blog of blogs) {
        let slug = generateSlug(blog.title);
        let counter = 1;
        let uniqueSlug = slug;

        // Check if slug already exists and make it unique
        while (true) {
          const existing = await queryInterface.sequelize.query(
            'SELECT id FROM blogs WHERE slug = ? AND id != ?',
            {
              replacements: [uniqueSlug, blog.id],
              type: Sequelize.QueryTypes.SELECT
            }
          );

          if (existing.length === 0) {
            break;
          }

          uniqueSlug = `${slug}-${counter}`;
          counter++;
        }

        // Update the blog with the unique slug
        await queryInterface.sequelize.query(
          'UPDATE blogs SET slug = ? WHERE id = ?',
          {
            replacements: [uniqueSlug, blog.id],
            type: Sequelize.QueryTypes.UPDATE
          }
        );

        console.log(`Updated blog "${blog.title}" with slug: ${uniqueSlug}`);
      }

      console.log('All blogs have been updated with slugs');
    } catch (error) {
      console.log('Error populating slugs:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Set all slugs to NULL
      await queryInterface.sequelize.query(
        'UPDATE blogs SET slug = NULL',
        { type: Sequelize.QueryTypes.UPDATE }
      );
      console.log('All slugs have been reset to NULL');
    } catch (error) {
      console.log('Error during rollback:', error.message);
    }
  }
}; 