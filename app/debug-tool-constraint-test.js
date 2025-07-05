// Debug test to isolate the tool constraint issue
const { MultiToolCallHandler } = require('./dist-test/tools/multi-call.js');

async function debugToolConstraints() {
  const handler = new MultiToolCallHandler();
  
  const sampleTools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write to a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['path', 'content']
        }
      }
    }
  ];

  const sampleToolCalls = [
    {
      id: 'call_ABC123DEF456GHI789JKL012M',
      type: 'function',
      function: {
        name: 'list_files', // This tool is NOT in the available tools!
        arguments: JSON.stringify({ directory: '/project' })
      }
    },
    {
      id: 'call_DEF456GHI789JKL012MNO345A',
      type: 'function',
      function: {
        name: 'read_file', // This tool IS in the available tools
        arguments: JSON.stringify({ path: '/project/config.json' })
      }
    }
  ];

  const constrainedRequest = {
    tools: sampleTools, // Only read_file and write_file
    toolCalls: sampleToolCalls, // Includes list_files and read_file
    sessionId: 'debug-session-001'
  };

  console.log('Available tools:', sampleTools.map(t => t.function.name));
  console.log('Tool calls:', sampleToolCalls.map(tc => tc.function.name));
  
  const result = await handler.processMultipleToolCalls(constrainedRequest);
  
  console.log('Result success:', result.success);
  console.log('Tool call results:', result.results.map(r => ({
    toolName: r.toolName,
    success: r.success,
    errors: r.errors
  })));
  
  // Check if all tool calls match available tools
  const allMatch = result.toolCalls.every(call => 
    constrainedRequest.tools.some(tool => tool.function.name === call.function.name)
  );
  console.log('All tool calls match available tools:', allMatch);
  
  return result;
}

debugToolConstraints().catch(console.error);