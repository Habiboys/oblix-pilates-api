const { Trainer } = require('../models');

/**
 * Get trainer rate berdasarkan jenis kelas
 * @param {string} trainerId - ID trainer
 * @param {string} classType - 'group', 'semi_private', atau 'private'
 * @returns {Promise<number>} Rate dalam rupiah
 */
const getTrainerRateByClassType = async (trainerId, classType) => {
  try {
    const trainer = await Trainer.findByPk(trainerId);
    if (!trainer) {
      throw new Error('Trainer not found');
    }
    
    return trainer.getRateByClassType(classType);
  } catch (error) {
    console.error('Error getting trainer rate:', error);
    // Return default rate jika error
    switch (classType) {
      case 'group':
        return 250000;
      case 'semi_private':
        return 250000;
      case 'private':
        return 275000;
      default:
        return 250000;
    }
  }
};

/**
 * Get semua rate trainer
 * @param {string} trainerId - ID trainer
 * @returns {Promise<object>} Object berisi semua rate
 */
const getTrainerAllRates = async (trainerId) => {
  try {
    const trainer = await Trainer.findByPk(trainerId);
    if (!trainer) {
      throw new Error('Trainer not found');
    }
    
    return trainer.getAllRates();
  } catch (error) {
    console.error('Error getting trainer rates:', error);
    // Return default rates jika error
    return {
      group_class: 250000,
      semi_private_class: 250000,
      private_class: 275000,
      default: 250000
    };
  }
};

/**
 * Calculate total trainer fee untuk multiple schedules
 * @param {string} trainerId - ID trainer
 * @param {Array} schedules - Array of schedule objects dengan type
 * @returns {Promise<number>} Total fee dalam rupiah
 */
const calculateTrainerTotalFee = async (trainerId, schedules) => {
  try {
    const trainer = await Trainer.findByPk(trainerId);
    if (!trainer) {
      throw new Error('Trainer not found');
    }

    let totalFee = 0;
    for (const schedule of schedules) {
      const rate = trainer.getRateByClassType(schedule.type);
      totalFee += rate;
    }

    return totalFee;
  } catch (error) {
    console.error('Error calculating trainer total fee:', error);
    return 0;
  }
};

module.exports = {
  getTrainerRateByClassType,
  getTrainerAllRates,
  calculateTrainerTotalFee
}; 