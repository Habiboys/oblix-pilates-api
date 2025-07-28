const { Member } = require('../models');

// Generate unique member code
const generateMemberCode = async () => {
  const prefix = 'MBR';
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  // Get the latest member code for this year
  const latestMember = await Member.findOne({
    where: {
      member_code: {
        [require('sequelize').Op.like]: `${prefix}${currentYear}%`
      }
    },
    order: [['member_code', 'DESC']]
  });

  let sequence = 1;
  
  if (latestMember && latestMember.member_code) {
    // Extract sequence number from existing code
    const existingSequence = parseInt(latestMember.member_code.slice(-4));
    sequence = existingSequence + 1;
  }

  // Format: MBR + YY + 4-digit sequence (e.g., MBR240001)
  const memberCode = `${prefix}${currentYear}${sequence.toString().padStart(4, '0')}`;
  
  return memberCode;
};

module.exports = {
  generateMemberCode
}; 