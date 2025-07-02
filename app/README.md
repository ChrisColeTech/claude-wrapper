# Claude Code OpenAI Wrapper - Node.js Application

This is the Node.js/TypeScript implementation of the Claude Code OpenAI Wrapper, ported from the Python version using **in-memory storage** matching the Python approach exactly.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp ../.env.example .env
   # Edit .env with your configuration
   ```

3. **Development mode:**
   ```bash
   npm run dev
   ```

4. **Production build:**
   ```bash
   npm run build
   npm start
   ```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🔧 Development

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

## 🏗️ Storage Architecture

This application uses **in-memory storage** exactly matching the Python implementation:
- **Sessions**: Stored in JavaScript Map, same as Python dict
- **Messages**: Processed in-memory, no persistence required
- **Authentication**: Environment variable based, no database
- **Mock repositories**: Available for testing only

## 📚 Documentation

See the `../docs/` folder for complete documentation:
- `../docs/README.md` - Feature analysis
- `../docs/IMPLEMENTATION_PLAN.md` - 15-phase implementation plan
- `../docs/API_REFERENCE.md` - Complete API documentation
- `../docs/ARCHITECTURE.md` - Architecture guidelines
- `../docs/CODE_EXAMPLES.md` - Python-to-TypeScript examples

## 🏗️ Implementation Status

This application is scaffolded and ready for implementation. Follow the 15-phase plan in `../docs/IMPLEMENTATION_PLAN.md` to systematically port all features from the Python version.

### Current Status
- ✅ Project structure created
- ✅ Basic Express server setup
- ✅ TypeScript configuration
- ✅ Testing framework configured
- ✅ In-memory storage services created
- ⚪ Implementation phases 1-15 pending

## 🔗 Related Files

- Python source: Check the Python files referenced in the implementation plan
- Documentation: `../docs/` folder
- Requirements: `../REQUIREMENTS.md`
