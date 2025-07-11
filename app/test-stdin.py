#!/usr/bin/env python3
import requests
import json

# Create a large prompt > 50KB to test stdin approach
large_content = 'x' * (60 * 1024)  # 60KB of content
large_tools = []

# Simulate large MCP tool definitions
for i in range(50):
    large_tools.append({
        "type": "function",
        "function": {
            "name": f"large_tool_{i}",
            "description": f"This is a large tool description that simulates real MCP tool contexts. {'x' * 500}",
            "parameters": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "Parameter 1"},
                    "param2": {"type": "number", "description": "Parameter 2"},
                },
                "required": ["param1", "param2"]
            }
        }
    })

def test_stdin_implementation():
    print('Testing stdin implementation with large prompt...')
    print(f'Prompt size: {len(large_content)} bytes')
    print(f'Tools count: {len(large_tools)}')
    
    payload = {
        "model": "sonnet",
        "messages": [
            {
                "role": "user",
                "content": f"Process this large content (first 100 chars): {large_content[:100]}"
            }
        ],
        "tools": large_tools
    }
    
    try:
        response = requests.post('http://localhost:8080/v1/chat/completions', 
                               json=payload, 
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            print('✅ Success! Stdin implementation working')
            result = response.json()
            print(f'Response length: {len(result["choices"][0]["message"]["content"])}')
        else:
            print(f'❌ Error: {response.status_code}')
            print(response.text)
            
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == "__main__":
    test_stdin_implementation()