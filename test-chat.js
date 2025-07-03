#!/usr/bin/env node

const axios = require('axios');

async function testChat() {
  try {
    console.log('Testing chat completion endpoint...');
    
    const response = await axios.post('http://localhost:8000/v1/chat/completions', {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you tell me what 2+2 equals and explain it briefly?'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Chat completion successful!');
    console.log('Response:', response.data);
    console.log('Content:', response.data.choices[0].message.content);
    console.log('Tokens used:', response.data.usage);
    
  } catch (error) {
    console.error('❌ Chat completion failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testChat();