import express from 'express';
import cors from 'cors';
import { ClaudeWrapper } from './wrapper';
import { OpenAIRequest } from './types';

const app = express();
const wrapper = new ClaudeWrapper();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'claude-wrapper-poc' });
});

// OpenAI compatible models endpoint
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic' }
    ]
  });
});

// Main chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    console.log('📥 Incoming request:', JSON.stringify(req.body, null, 2));
    
    const request: OpenAIRequest = req.body;
    
    // Basic validation
    if (!request.model || !request.messages || !Array.isArray(request.messages)) {
      return res.status(400).json({
        error: {
          message: 'Invalid request format',
          type: 'invalid_request_error'
        }
      });
    }

    const response = await wrapper.handleChatCompletion(request);
    
    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'internal_server_error'
      }
    });
  }
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'internal_server_error'
    }
  });
});

export { app };