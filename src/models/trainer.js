'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Trainer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Trainer.hasMany(models.Schedule, {
        foreignKey: 'trainer_id',
      });
    }

    /**
     * Get rate berdasarkan jenis kelas
     * @param {string} classType - 'group', 'semi_private', atau 'private'
     * @returns {number} Rate dalam rupiah
     */
    getRateByClassType(classType) {
      switch (classType) {
        case 'group':
          return this.rate_group_class || this.rate_per_class || 250000;
        case 'semi_private':
          return this.rate_semi_private_class || this.rate_per_class || 250000;
        case 'private':
          return this.rate_private_class || this.rate_per_class || 275000;
        default:
          return this.rate_per_class || 250000;
      }
    }

    /**
     * Get semua rate dalam format object
     * @returns {object} Object berisi semua rate
     */
    getAllRates() {
      return {
        group_class: this.rate_group_class || this.rate_per_class || 250000,
        semi_private_class: this.rate_semi_private_class || this.rate_per_class || 250000,
        private_class: this.rate_private_class || this.rate_per_class || 275000,
        default: this.rate_per_class || 250000
      };
    }
  }
  Trainer.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    rate_per_class: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Rate default (legacy field)'
    },
    rate_group_class: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Group Class (dalam rupiah)'
    },
    rate_semi_private_class: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Semi-Private Class (dalam rupiah)'
    },
    rate_private_class: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Rate untuk Private Class (dalam rupiah)'
    },
    picture: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    instagram: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tiktok: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
  }, {
    sequelize,
    modelName: 'Trainer',
    tableName: 'trainers',
  });
  return Trainer;
}; 