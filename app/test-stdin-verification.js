const fs = require('fs');
const { exec } = require('child_process');

// Create a large prompt that will definitely trigger stdin (100KB)
const largeContent = 'x'.repeat(100 * 1024);

// Test payload with large content
const testPayload = {
  model: 'sonnet',
  messages: [
    {
      role: 'user',
      content: `Large content test: ${largeContent}`
    }
  ]
};

console.log('Testing stdin implementation...');
console.log(`Content size: ${largeContent.length} bytes`);
console.log(`Full payload size: ${JSON.stringify(testPayload).length} bytes`);

// Make request
fetch('http://localhost:8080/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testPayload)
})
.then(response => response.json())
.then(data => {
  console.log('\n✅ Request completed successfully');
  console.log(`Response: ${data.choices[0].message.content.substring(0, 100)}...`);
  
  // Check if temp files were created (they should be cleaned up)
  console.log('\n🔍 Checking for temp file traces...');
  exec('ls -la /tmp/claude-wrapper/ 2>/dev/null || echo "No temp directory found"', (error, stdout) => {
    console.log(`Temp directory status: ${stdout.trim()}`);
    
    // Check logs for any stdin-related activity
    console.log('\n📋 Checking recent logs...');
    return fetch('http://localhost:8080/logs')
      .then(response => response.json())
      .then(logs => {
        const recentLogs = logs.logs.slice(0, 10);
        console.log(`Found ${recentLogs.length} recent log entries`);
        
        // Look for any evidence of stdin execution
        const hasStdinLogs = recentLogs.some(log => 
          log.message.includes('stdin') || 
          log.message.includes('temp') ||
          log.message.includes('strategy')
        );
        
        console.log(`Stdin logs found: ${hasStdinLogs}`);
        
        if (!hasStdinLogs) {
          console.log('⚠️  No stdin logs found - may be using command line approach');
        }
      });
  });
})
.catch(error => {
  console.error('❌ Request failed:', error);
});