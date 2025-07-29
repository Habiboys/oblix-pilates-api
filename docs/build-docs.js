#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Script untuk menggabungkan semua file dokumentasi modular menjadi satu file
 * Usage: node build-docs.js
 */

function loadYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

function mergeSchemas(baseDoc, requestsDoc) {
  if (!requestsDoc || !requestsDoc.components || !requestsDoc.components.schemas) {
    return baseDoc;
  }

  if (!baseDoc.components) {
    baseDoc.components = {};
  }
  if (!baseDoc.components.schemas) {
    baseDoc.components.schemas = {};
  }

  // Merge request schemas
  Object.assign(baseDoc.components.schemas, requestsDoc.components.schemas);
  
  return baseDoc;
}

function mergePaths(baseDoc, pathsDoc) {
  if (!pathsDoc || !pathsDoc.paths) {
    return baseDoc;
  }

  if (!baseDoc.paths) {
    baseDoc.paths = {};
  }

  // Merge paths
  Object.assign(baseDoc.paths, pathsDoc.paths);
  
  return baseDoc;
}

function buildDocumentation() {
  console.log('🔨 Building documentation from modular files...');

  // Load base configuration
  const baseDoc = loadYamlFile(path.join(__dirname, 'base.yaml'));
  if (!baseDoc) {
    console.error('❌ Failed to load base.yaml');
    process.exit(1);
  }

  // Load and merge request schemas
  const requestsDoc = loadYamlFile(path.join(__dirname, 'requests.yaml'));
  if (requestsDoc) {
    mergeSchemas(baseDoc, requestsDoc);
    console.log('✅ Merged request schemas');
  }

  // Load and merge authentication endpoints
  const authDoc = loadYamlFile(path.join(__dirname, 'auth.yaml'));
  if (authDoc) {
    mergePaths(baseDoc, authDoc);
    console.log('✅ Merged authentication endpoints');
  }

  // Load and merge content management endpoints
  const contentDoc = loadYamlFile(path.join(__dirname, 'content.yaml'));
  if (contentDoc) {
    mergePaths(baseDoc, contentDoc);
    console.log('✅ Merged content management endpoints');
  }

  // Load and merge profile management endpoints
  const profileDoc = loadYamlFile(path.join(__dirname, 'profile.yaml'));
  if (profileDoc) {
    mergePaths(baseDoc, profileDoc);
    console.log('✅ Merged profile management endpoints');
  }

  // Load and merge trainer management endpoints
  const trainerDoc = loadYamlFile(path.join(__dirname, 'trainer.yaml'));
  if (trainerDoc) {
    mergePaths(baseDoc, trainerDoc);
    console.log('✅ Merged trainer management endpoints');
  }

  // Load and merge membership package management endpoints
const membershipPackageDoc = loadYamlFile(path.join(__dirname, 'membershipPackage.yaml'));
if (membershipPackageDoc) {
  mergePaths(baseDoc, membershipPackageDoc);
  console.log('✅ Merged membership package management endpoints');
}

// Load and merge trial package management endpoints
const trialPackageDoc = loadYamlFile(path.join(__dirname, 'trialPackage.yaml'));
if (trialPackageDoc) {
  mergePaths(baseDoc, trialPackageDoc);
  console.log('✅ Merged trial package management endpoints');
}

// Load and merge promo package management endpoints
const promoPackageDoc = loadYamlFile(path.join(__dirname, 'promoPackage.yaml'));
if (promoPackageDoc) {
  mergePaths(baseDoc, promoPackageDoc);
  console.log('✅ Merged promo package management endpoints');
}

// Load and merge bonus package management endpoints
const bonusPackageDoc = loadYamlFile(path.join(__dirname, 'bonusPackage.yaml'));
if (bonusPackageDoc) {
  mergePaths(baseDoc, bonusPackageDoc);
  console.log('✅ Merged bonus package management endpoints');
}

// Load and merge staff management endpoints
const staffDoc = loadYamlFile(path.join(__dirname, 'staff.yaml'));
if (staffDoc) {
  mergePaths(baseDoc, staffDoc);
  console.log('✅ Merged staff management endpoints');
}

// Load and merge category management endpoints
const categoryDoc = loadYamlFile(path.join(__dirname, 'category.yaml'));
if (categoryDoc) {
  mergePaths(baseDoc, categoryDoc);
  console.log('✅ Merged category management endpoints');
}

// Load and merge order management endpoints
const orderDoc = loadYamlFile(path.join(__dirname, 'order.yaml'));
if (orderDoc) {
  console.log('📋 Order doc paths:', Object.keys(orderDoc.paths || {}));
  mergePaths(baseDoc, orderDoc);
  console.log('✅ Merged order management endpoints');
} else {
  console.log('❌ Failed to load order.yaml');
}

// Load and merge dashboard endpoints
const dashboardDoc = loadYamlFile(path.join(__dirname, 'dashboard.yaml'));
if (dashboardDoc) {
  console.log('📋 Dashboard doc paths:', Object.keys(dashboardDoc.paths || {}));
  mergePaths(baseDoc, dashboardDoc);
  console.log('✅ Merged dashboard endpoints');
} else {
  console.log('❌ Failed to load dashboard.yaml');
}

// Load and merge payment endpoints
const paymentEndpointsDoc = loadYamlFile(path.join(__dirname, 'payment-endpoints.yaml'));
if (paymentEndpointsDoc) {
  mergePaths(baseDoc, paymentEndpointsDoc);
  console.log('✅ Merged payment endpoints');
}

// Load and merge schedule management endpoints
const scheduleDoc = loadYamlFile(path.join(__dirname, 'schedule.yaml'));
if (scheduleDoc) {
  console.log('📋 Schedule doc paths:', Object.keys(scheduleDoc.paths || {}));
  mergePaths(baseDoc, scheduleDoc);
  console.log('✅ Merged schedule management endpoints');
} else {
  console.log('❌ Failed to load schedule.yaml');
}

// Load and merge booking management endpoints
const bookingDoc = loadYamlFile(path.join(__dirname, 'booking.yaml'));
if (bookingDoc) {
  console.log('📋 Booking doc paths:', Object.keys(bookingDoc.paths || {}));
  mergePaths(baseDoc, bookingDoc);
  console.log('✅ Merged booking management endpoints');
} else {
  console.log('❌ Failed to load booking.yaml');
}

// Load and merge member package management endpoints
const memberPackageDoc = loadYamlFile(path.join(__dirname, 'memberPackage.yaml'));
if (memberPackageDoc) {
  console.log('📋 Member Package doc paths:', Object.keys(memberPackageDoc.paths || {}));
  mergePaths(baseDoc, memberPackageDoc);
  console.log('✅ Merged member package management endpoints');
} else {
  console.log('❌ Failed to load memberPackage.yaml');
}

// Load and merge test endpoints
const testDoc = loadYamlFile(path.join(__dirname, 'test.yaml'));
if (testDoc) {
  console.log('📋 Test doc paths:', Object.keys(testDoc.paths || {}));
  mergePaths(baseDoc, testDoc);
  console.log('✅ Merged test endpoints');
} else {
  console.log('❌ Failed to load test.yaml');
}

// Load and merge class management endpoints
const classDoc = loadYamlFile(path.join(__dirname, 'class.yaml'));
if (classDoc) {
  console.log('📋 Class doc paths:', Object.keys(classDoc.paths || {}));
  mergePaths(baseDoc, classDoc);
  console.log('✅ Merged class management endpoints');
} else {
  console.log('❌ Failed to load class.yaml');
}

// Load and merge member management endpoints
const memberDoc = loadYamlFile(path.join(__dirname, 'member.yaml'));
if (memberDoc) {
  console.log('📋 Member doc paths:', Object.keys(memberDoc.paths || {}));
  mergePaths(baseDoc, memberDoc);
  console.log('✅ Merged member management endpoints');
} else {
  console.log('❌ Failed to load member.yaml');
}

// Load and merge check class endpoints
const checkClassDoc = loadYamlFile(path.join(__dirname, 'checkClass.yaml'));
if (checkClassDoc) {
  console.log('📋 Check Class doc paths:', Object.keys(checkClassDoc.paths || {}));
  mergePaths(baseDoc, checkClassDoc);
  console.log('✅ Merged check class endpoints');
} else {
  console.log('❌ Failed to load checkClass.yaml');
}

// Load and merge my classes endpoints
const myClassesDoc = loadYamlFile(path.join(__dirname, 'myclasses.yaml'));
if (myClassesDoc) {
  console.log('📋 My Classes doc paths:', Object.keys(myClassesDoc.paths || {}));
  mergePaths(baseDoc, myClassesDoc);
  console.log('✅ Merged my classes endpoints');
} else {
  console.log('❌ Failed to load myclasses.yaml');
}


    // Add tags
  baseDoc.tags = [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints'
    },
    {
      name: 'Content Management',
      description: 'Banner, blog, FAQ, gallery, and testimonial management endpoints'
    },
    {
      name: 'Profile Management',
      description: 'User profile management endpoints'
    },
    {
      name: 'Trainer Management',
      description: 'Trainer management endpoints'
    },
      {
    name: 'Membership Package Management',
    description: 'Membership package management endpoints'
  },
  {
    name: 'Trial Package Management',
    description: 'Trial package management endpoints'
  },
  {
    name: 'Promo Package Management',
    description: 'Promo package management endpoints'
  },
  {
    name: 'Bonus Package Management',
    description: 'Bonus package management endpoints'
  },
  {
    name: 'Staff Management',
    description: 'Staff management endpoints'
  },
  {
    name: 'Category Management',
    description: 'Category management endpoints'
  },
  {
    name: 'Order Management',
    description: 'Order and payment management endpoints'
  },
  {
    name: 'Payment',
    description: 'Payment-related endpoints for Midtrans integration'
  },
  {
    name: 'Schedule Management',
    description: 'Schedule management endpoints for group, semi-private, and private classes'
  },
  {
    name: 'Booking Management',
    description: 'Booking management endpoints for group and semi-private schedules'
  },
  {
    name: 'Member Package Management',
    description: 'Member package management and tracking endpoints'
  },
  {
    name: 'Class Management',
    description: 'Class management endpoints'
  },
  {
    name: 'Member Management',
    description: 'Member management endpoints'
  },
  {
    name: 'Check Class',
    description: 'Check class endpoints'
  },
  {
    name: 'My Classes',
    description: 'Member\'s class history and tracking endpoints'
  },
  {
    name: 'Dashboard',
    description: 'Admin dashboard with metrics and today\'s classes'
  }
  ];

  // Write the combined documentation
  const outputPath = path.join(__dirname, '..', 'documentation.yaml');
  try {
    const yamlOutput = yaml.dump(baseDoc, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
    
    fs.writeFileSync(outputPath, yamlOutput, 'utf8');
    console.log(`✅ Documentation built successfully: ${outputPath}`);
    
    // Count endpoints
    const endpointCount = Object.keys(baseDoc.paths || {}).length;
    console.log(`📊 Total endpoints: ${endpointCount}`);
    
    // Count schemas
    const schemaCount = Object.keys(baseDoc.components?.schemas || {}).length;
    console.log(`📋 Total schemas: ${schemaCount}`);
    
  } catch (error) {
    console.error('❌ Failed to write documentation:', error.message);
    process.exit(1);
  }
}

// Run the build process
if (require.main === module) {
  buildDocumentation();
}

module.exports = { buildDocumentation }; 