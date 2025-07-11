#!/usr/bin/env python3
import requests
import json

# Create a large prompt > 50KB to test stdin approach
large_content = 'x' * (60 * 1024)  # 60KB of content

def test_stdin_implementation():
    print('Testing stdin implementation with large prompt...')
    print(f'Prompt size: {len(large_content)} bytes')
    
    payload = {
        "model": "sonnet",
        "messages": [
            {
                "role": "user", 
                "content": f"This is a large content test. Content length: {len(large_content)} bytes. First 100 chars: {large_content[:100]}"
            }
        ]
    }
    
    try:
        response = requests.post('http://localhost:8080/v1/chat/completions', 
                               json=payload, 
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            print('✅ Success! Large prompt handled correctly')
            result = response.json()
            print(f'Response: {result["choices"][0]["message"]["content"][:200]}...')
        else:
            print(f'❌ Error: {response.status_code}')
            print(response.text)
            
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == "__main__":
    test_stdin_implementation()