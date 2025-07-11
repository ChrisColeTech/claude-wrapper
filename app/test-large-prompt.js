const axios = require('axios');

// Create a large prompt > 50KB to test stdin approach
const largeContent = 'x'.repeat(60 * 1024); // 60KB of content
const largeMcpTools = [];

// Simulate large MCP tool definitions
for (let i = 0; i < 100; i++) {
  largeMcpTools.push({
    type: "function",
    function: {
      name: `large_tool_${i}`,
      description: `This is a large tool description that simulates real MCP tool contexts. ${'x'.repeat(500)}`,
      parameters: {
        type: "object",
        properties: {
          param1: { type: "string", description: "Parameter 1" },
          param2: { type: "number", description: "Parameter 2" },
          param3: { type: "boolean", description: "Parameter 3" }
        },
        required: ["param1", "param2"]
      }
    }
  });
}

async function testStdinImplementation() {
  try {
    console.log('Testing stdin implementation with large prompt...');
    console.log(`Prompt size: ${largeContent.length} bytes`);
    console.log(`Tools count: ${largeMcpTools.length}`);
    
    const response = await axios.post('http://localhost:8080/v1/chat/completions', {
      model: 'sonnet',
      messages: [
        {
          role: 'user',
          content: `Process this large content: ${largeContent}`
        }
      ],
      tools: largeMcpTools
    });
    
    console.log('✅ Success! Stdin implementation working');
    console.log('Response length:', response.data.choices[0].message.content.length);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testStdinImplementation();