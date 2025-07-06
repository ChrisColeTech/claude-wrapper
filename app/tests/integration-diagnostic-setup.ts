import { resetErrorClassifier } from '../src/middleware/error-classifier';
import { resetValidationHandler } from '../src/middleware/validation-handler';

// Global diagnostic state
declare global {
  var integrationDiagnostics: {
    testResults: any[];
    singletonStates: any[];
    responseCaptures: any[];
    classificationCaptures: any[];
    performanceMetrics: any[];
    captureTestResult: (result: any) => void;
    captureSingletonState: () => void;
    captureResponse: (response: any) => void;
    captureClassification: (classification: any) => void;
  };
}

global.integrationDiagnostics = {
  testResults: [],
  singletonStates: [],
  responseCaptures: [],
  classificationCaptures: [],
  performanceMetrics: [],
  
  captureTestResult(result: any) {
    this.testResults.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      result: result
    });
  },

  captureSingletonState() {
    try {
      const { getErrorClassifier } = require('../src/middleware/error-classifier');
      const { getValidationHandler } = require('../src/middleware/validation-handler');
      
      this.singletonStates.push({
        timestamp: Date.now(),
        testName: expect.getState().currentTestName || 'unknown',
        errorClassifierStats: getErrorClassifier().getStatistics(),
        validationHandlerStats: getValidationHandler().getPerformanceStats()
      });
    } catch (error) {
      console.log('Failed to capture singleton state:', error.message);
    }
  },

  captureResponse(response: any) {
    this.responseCaptures.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      status: response.status,
      body: response.body,
      headers: response.headers
    });
  },

  captureClassification(classification: any) {
    this.classificationCaptures.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      classification: classification
    });
  }
};

// Enhanced beforeEach
beforeEach(() => {
  // Reset singleton state
  resetErrorClassifier();
  resetValidationHandler();
  
  // Clear diagnostic data for this test
  const testName = expect.getState().currentTestName || 'unknown';
  console.log(`🔍 Starting diagnostic test: ${testName}`);
});

// Enhanced afterEach
afterEach(() => {
  // Capture final singleton state
  global.integrationDiagnostics.captureSingletonState();
  
  const testName = expect.getState().currentTestName || 'unknown';
  console.log(`✅ Completed diagnostic test: ${testName}`);
});

// Enhanced afterAll
afterAll(() => {
  // Generate comprehensive diagnostic report
  const fs = require('fs');
  const path = require('path');
  
  const reportPath = path.join(__dirname, 'logs/integration-diagnostic-data.json');
  
  // Ensure logs directory exists
  const logsDir = path.dirname(reportPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    nodeVersion: process.version,
    testResults: global.integrationDiagnostics.testResults,
    singletonStates: global.integrationDiagnostics.singletonStates,
    responseCaptures: global.integrationDiagnostics.responseCaptures,
    classificationCaptures: global.integrationDiagnostics.classificationCaptures,
    performanceMetrics: global.integrationDiagnostics.performanceMetrics
  }, null, 2));
  
  console.log(`📊 Integration diagnostic data saved to ${reportPath}`);
});