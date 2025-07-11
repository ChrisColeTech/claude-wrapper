#!/bin/bash

# Create a large prompt > 50KB
LARGE_CONTENT=$(printf 'x%.0s' {1..60000})  # 60KB

echo "Testing stdin implementation with large prompt..."
echo "Prompt size: ${#LARGE_CONTENT} bytes"

# Test with curl
curl -s "http://localhost:8080/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [
      {
        "role": "user",
        "content": "This is a large content test. Content length: '${#LARGE_CONTENT}' bytes. Content preview: '${LARGE_CONTENT:0:100}'"
      }
    ]
  }' | jq -r '.choices[0].message.content' | head -3

echo -e "\nDone. Check logs for stdin strategy selection."