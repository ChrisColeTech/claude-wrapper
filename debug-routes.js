/**
 * Debug script to check what routes are mounted
 */

const express = require('express');

// Try to import the monitoring routes directly
try {
  const monitoring = require('./app/dist/routes/monitoring');
  console.log('✅ Monitoring routes imported successfully');
  console.log('Available exports:', Object.keys(monitoring));
  
  if (monitoring.monitoringRoutes) {
    console.log('✅ monitoringRoutes found');
  } else {
    console.log('❌ monitoringRoutes not found in exports');
  }
  
  if (monitoring.createMonitoringRoutes) {
    console.log('✅ createMonitoringRoutes found');
  } else {
    console.log('❌ createMonitoringRoutes not found in exports');
  }
} catch (error) {
  console.error('❌ Failed to import monitoring routes:', error.message);
}

// Try to create a simple test app
try {
  const { createApp } = require('./app/dist/server');
  console.log('✅ Server module imported successfully');
  
  const testConfig = {
    PORT: 3000,
    CORS_ORIGINS: '*',
    MAX_TIMEOUT: 30000,
    NODE_ENV: 'test'
  };
  
  const app = createApp(testConfig);
  console.log('✅ App created successfully');
  
  // List all routes
  console.log('\n📋 Registered Routes:');
  app._router.stack.forEach((middleware, index) => {
    if (middleware.route) {
      console.log(`${index + 1}. ${middleware.route.methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      console.log(`${index + 1}. Router middleware - ${middleware.regexp}`);
    } else {
      console.log(`${index + 1}. ${middleware.name} middleware`);
    }
  });
  
} catch (error) {
  console.error('❌ Failed to create app:', error.message);
  console.error(error.stack);
}