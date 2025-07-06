#!/usr/bin/env node
/**
 * Audit Singleton Usage Script
 * Comprehensive audit of singleton pattern usage across the codebase
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SingletonAuditor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      directInstantiations: [],
      singletonCalls: [],
      importPatterns: [],
      recommendations: [],
      summary: {
        totalDirectInstantiations: 0,
        totalSingletonCalls: 0,
        totalImportPatterns: 0,
        complianceScore: 0
      }
    };
  }

  async auditSingletonUsage() {
    console.log('🔍 Starting singleton usage audit...');
    
    try {
      // Find direct instantiations
      await this.findDirectInstantiations();
      
      // Find singleton function calls
      await this.findSingletonCalls();
      
      // Find import patterns
      await this.findImportPatterns();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Calculate compliance score
      this.calculateComplianceScore();
      
      // Generate report
      this.generateReport();
      
      console.log('✅ Singleton audit completed successfully');
      return this.results;
      
    } catch (error) {
      console.error('❌ Singleton audit failed:', error.message);
      throw error;
    }
  }

  async findDirectInstantiations() {
    console.log('  📋 Finding direct instantiations...');
    
    try {
      // Find ErrorClassifier instantiations
      const { stdout: errorClassifierResults } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "new ErrorClassifier()" {} +'
      );
      
      if (errorClassifierResults.trim()) {
        errorClassifierResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.directInstantiations.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'ErrorClassifier'
            });
          }
        });
      }
      
      // Find ValidationHandler instantiations
      const { stdout: validationHandlerResults } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "new ValidationHandler()" {} +'
      );
      
      if (validationHandlerResults.trim()) {
        validationHandlerResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.directInstantiations.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'ValidationHandler'
            });
          }
        });
      }
      
      this.results.summary.totalDirectInstantiations = this.results.directInstantiations.length;
      console.log(`    Found ${this.results.summary.totalDirectInstantiations} direct instantiations`);
      
    } catch (error) {
      // No results found (which is good for compliance)
      console.log('    ✅ No direct instantiations found');
    }
  }

  async findSingletonCalls() {
    console.log('  📋 Finding singleton function calls...');
    
    try {
      // Find getErrorClassifier calls
      const { stdout: getErrorClassifierResults } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "getErrorClassifier()" {} +'
      );
      
      if (getErrorClassifierResults.trim()) {
        getErrorClassifierResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.singletonCalls.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'getErrorClassifier'
            });
          }
        });
      }
      
      // Find getValidationHandler calls
      const { stdout: getValidationHandlerResults } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "getValidationHandler()" {} +'
      );
      
      if (getValidationHandlerResults.trim()) {
        getValidationHandlerResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.singletonCalls.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'getValidationHandler'
            });
          }
        });
      }
      
      this.results.summary.totalSingletonCalls = this.results.singletonCalls.length;
      console.log(`    Found ${this.results.summary.totalSingletonCalls} singleton function calls`);
      
    } catch (error) {
      console.log('    ⚠️ No singleton function calls found');
    }
  }

  async findImportPatterns() {
    console.log('  📋 Finding import patterns...');
    
    try {
      // Find ErrorClassifier imports
      const { stdout: errorClassifierImports } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "import.*ErrorClassifier" {} +'
      );
      
      if (errorClassifierImports.trim()) {
        errorClassifierImports.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.importPatterns.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'ErrorClassifier'
            });
          }
        });
      }
      
      // Find ValidationHandler imports
      const { stdout: validationHandlerImports } = await execAsync(
        'find app/ -name "*.ts" -exec grep -n "import.*ValidationHandler" {} +'
      );
      
      if (validationHandlerImports.trim()) {
        validationHandlerImports.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.results.importPatterns.push({
              file: match[1],
              line: parseInt(match[2]),
              content: match[3].trim(),
              type: 'ValidationHandler'
            });
          }
        });
      }
      
      this.results.summary.totalImportPatterns = this.results.importPatterns.length;
      console.log(`    Found ${this.results.summary.totalImportPatterns} import patterns`);
      
    } catch (error) {
      console.log('    ⚠️ No import patterns found');
    }
  }

  generateRecommendations() {
    console.log('  📋 Generating recommendations...');
    
    if (this.results.summary.totalDirectInstantiations > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        issue: 'Direct Instantiation Found',
        action: 'Replace all direct instantiations with singleton functions',
        details: `Found ${this.results.summary.totalDirectInstantiations} direct instantiations that should be replaced`,
        commands: [
          'find app/ -name "*.ts" -exec sed -i \'s/new ErrorClassifier()/getErrorClassifier()/g\' {} \\;',
          'find app/ -name "*.ts" -exec sed -i \'s/new ValidationHandler()/getValidationHandler()/g\' {} \\;'
        ]
      });
    }

    if (this.results.summary.totalSingletonCalls === 0 && this.results.summary.totalDirectInstantiations === 0) {
      this.results.recommendations.push({
        priority: 'INFO',
        issue: 'No Singleton Usage Found',
        action: 'Verify singleton patterns are being used where needed',
        details: 'No singleton usage detected - ensure this is intentional',
        commands: ['grep -r "ErrorClassifier\\|ValidationHandler" app/src/']
      });
    }

    if (this.results.summary.totalSingletonCalls > 0 && this.results.summary.totalDirectInstantiations === 0) {
      this.results.recommendations.push({
        priority: 'LOW',
        issue: 'Good Singleton Compliance',
        action: 'Maintain current singleton usage patterns',
        details: 'All singleton usage follows proper patterns',
        commands: []
      });
    }
  }

  calculateComplianceScore() {
    const totalUsage = this.results.summary.totalDirectInstantiations + this.results.summary.totalSingletonCalls;
    
    if (totalUsage === 0) {
      this.results.summary.complianceScore = 100; // No usage at all
    } else {
      const compliantUsage = this.results.summary.totalSingletonCalls;
      this.results.summary.complianceScore = Math.round((compliantUsage / totalUsage) * 100);
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/singleton-audit-report.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate human-readable report
    const textReportPath = path.join(__dirname, '../logs/singleton-audit-report.txt');
    let textReport = '';
    
    textReport += '🔍 Singleton Usage Audit Report\n';
    textReport += '================================\n\n';
    textReport += `📅 Generated: ${this.results.timestamp}\n`;
    textReport += `📊 Compliance Score: ${this.results.summary.complianceScore}%\n\n`;
    
    textReport += '📋 Summary:\n';
    textReport += `  Direct Instantiations: ${this.results.summary.totalDirectInstantiations}\n`;
    textReport += `  Singleton Function Calls: ${this.results.summary.totalSingletonCalls}\n`;
    textReport += `  Import Patterns: ${this.results.summary.totalImportPatterns}\n\n`;
    
    if (this.results.directInstantiations.length > 0) {
      textReport += '❌ Direct Instantiations Found:\n';
      this.results.directInstantiations.forEach(item => {
        textReport += `  ${item.file}:${item.line} - ${item.type}\n`;
        textReport += `    ${item.content}\n`;
      });
      textReport += '\n';
    }
    
    if (this.results.singletonCalls.length > 0) {
      textReport += '✅ Singleton Function Calls:\n';
      this.results.singletonCalls.forEach(item => {
        textReport += `  ${item.file}:${item.line} - ${item.type}\n`;
      });
      textReport += '\n';
    }
    
    if (this.results.recommendations.length > 0) {
      textReport += '💡 Recommendations:\n';
      this.results.recommendations.forEach(rec => {
        textReport += `  [${rec.priority}] ${rec.issue}\n`;
        textReport += `    Action: ${rec.action}\n`;
        textReport += `    Details: ${rec.details}\n`;
        if (rec.commands.length > 0) {
          textReport += `    Commands:\n`;
          rec.commands.forEach(cmd => {
            textReport += `      ${cmd}\n`;
          });
        }
        textReport += '\n';
      });
    }
    
    fs.writeFileSync(textReportPath, textReport);
    
    console.log(`📄 JSON report saved to: ${reportPath}`);
    console.log(`📄 Text report saved to: ${textReportPath}`);
    console.log(`📊 Compliance Score: ${this.results.summary.complianceScore}%`);
  }
}

// Main execution
async function main() {
  const auditor = new SingletonAuditor();
  
  try {
    await auditor.auditSingletonUsage();
    
    // Exit with appropriate code based on compliance
    const complianceScore = auditor.results.summary.complianceScore;
    if (complianceScore === 100) {
      console.log('🎉 Perfect singleton compliance!');
      process.exit(0);
    } else if (complianceScore >= 80) {
      console.log('⚠️ Good singleton compliance with minor issues');
      process.exit(0);
    } else {
      console.log('❌ Poor singleton compliance - immediate action required');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Audit failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SingletonAuditor };