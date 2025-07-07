import { app } from './server';

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log('🚀 Claude Wrapper POC started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/v1/models`);
  console.log(`  POST http://localhost:${PORT}/v1/chat/completions`);
  console.log('');
  console.log('Test with:');
  console.log(`  curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "What is 2+2?"}]}\'');
});