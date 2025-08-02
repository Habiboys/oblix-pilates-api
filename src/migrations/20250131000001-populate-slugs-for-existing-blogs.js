'use strict';

const { generateSlug } = require('../utils/slugUtils');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all existing blogs
    const blogs = await queryInterface.sequelize.query(
      'SELECT id, title FROM blogs WHERE slug IS NULL OR slug = ""',
      { type: Sequelize.QueryTypes.SELECT }
    );

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
    }
  },

  async down(queryInterface, Sequelize) {
    // This migration cannot be easily reversed as it would require
    // knowing the original state of the slugs
    console.log('This migration cannot be reversed');
  }
}; 