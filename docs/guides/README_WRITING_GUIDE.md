# Idiot's Guide to Writing the Claude-Wrapper README

## Step 1: Research Before Writing Anything

**DO THIS FIRST** - Read the actual code to understand how it works:

```bash
# Read these files to understand the real implementation:
cat package.json                    # Find the real CLI command name and scripts
cat app/src/cli.ts                 # Find actual CLI usage and options
git remote -v                      # Get the REAL repository URL
claude-wrapper --help              # Get actual CLI help output with ALL flags
cat REQUIREMENTS.md                # Understand project purpose and features
```

## Step 2: Find the Real CLI Command

From package.json `"bin"` section:
```json
"bin": {
  "claude-wrapper": "app/dist/cli.js"
}
```

This means the CLI command is `claude-wrapper`, NOT `npm start` or `npm run`.

## Step 3: Test the Actual Commands

Before documenting, test these commands:
```bash
# Test the actual CLI (the ONLY correct way):
claude-wrapper --help              # Get real help output with ALL flags and options

# NEVER document these - they are WRONG:
# node app/dist/cli.js --help      # WRONG - not how users run it
# npm start                        # WRONG - not how users run it
```

## Step 4: Document the Installation Method

This package IS published to npm via CI/CD on the release branch:

```markdown
## Installation

```bash
# Install globally from npm
npm install -g claude-wrapper
```

### Development Installation

For development or contributing:

```bash
# Clone repository (use REAL repo URL from git remote -v)
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper
npm install
npm run build
npm install -g .
```

**CRITICAL**: Always use the real repository URL from `git remote -v`, never fake URLs.

## Step 5: Get ALL Real CLI Options

**CRITICAL**: Don't assume or read code - get the ACTUAL help output:
```bash
# Run this command and copy the EXACT output:
claude-wrapper --help

# Copy ALL flags, ALL options, ALL examples from the help output
# Don't make up flags that don't exist
# Don't miss flags that do exist
# Use the EXACT flag descriptions from help output
```

## Step 6: Document Real Usage Examples

```markdown
## Usage

```bash
# Basic usage
node app/dist/cli.js                    # Start on default port 8000
node app/dist/cli.js 3000               # Start on port 3000
node app/dist/cli.js --port 3000        # Alternative port syntax

# With options
node app/dist/cli.js --verbose --debug  # Verbose debug mode
node app/dist/cli.js --no-interactive   # Skip interactive setup

# Daemon mode
node app/dist/cli.js --start            # Start in background
node app/dist/cli.js --status           # Check if running
node app/dist/cli.js --stop             # Stop background server

# If globally installed:
claude-wrapper 3000
claude-wrapper --start
```

## Step 7: Find Real npm Scripts

From package.json `"scripts"`:
```json
"build": "cd app && tsc",
"start": "node app/dist/cli.js",        # This is NOT how to run the CLI
"dev": "cd app && tsx watch src/index.ts",
"test": "cd app && jest --passWithNoTests"
```

**IMPORTANT**: `npm start` runs the CLI, but that's not how users should use it.

## Step 8: Find Real API Endpoints

From cli.ts lines 243-247:
```
Health:          http://localhost:8000/health
Chat:            http://localhost:8000/v1/chat/completions  
Models:          http://localhost:8000/v1/models
Sessions:        http://localhost:8000/v1/sessions
Auth Status:     http://localhost:8000/v1/auth/status
```

## Step 9: Find Real Environment Variables

Look in `app/src/utils/env.ts` or search for `process.env`:
```bash
grep -r "process.env" app/src/
```

Common ones likely include:
- `PORT`
- `DEBUG_MODE` 
- `VERBOSE`
- Authentication keys

## Step 10: Write Development Instructions

```markdown
## Development

```bash
# Setup
git clone <repo>
cd claude-wrapper
npm install

# Build
npm run build

# Run tests  
npm test

# Development mode
npm run dev                # Watch mode for development

# Linting
npm run lint
npm run type-check
```

## Step 11: Test Everything You Document

**CRITICAL**: Before adding any command to the README, actually run it and verify it works.

## Final README Structure

```markdown
# Claude Wrapper

[badges]

Brief description from package.json

## Installation

[Real installation steps]

## Usage

[Real CLI commands that actually work]

## API

[Real endpoints from the code]

## Development  

[Real development commands]

## Configuration

[Real environment variables]
```

## Key Rules

1. **GET REAL REPOSITORY URL** - Use `git remote -v`, not fake URLs
2. **TEST THE ACTUAL CLI** - Run `claude-wrapper --help` for real output  
3. **CHECK IF PUBLISHED** - Use `npm view claude-wrapper` to check if on npm
4. **COPY EXACT HELP OUTPUT** - Don't paraphrase or assume CLI options
5. **TEST EVERY COMMAND** - Before documenting it
6. **NO ASSUMPTIONS** - If you're not sure, test it
7. **INCLUDE ALL FLAGS** - Don't remove options that exist in help output

## Step 12: Add Missing Sections

The README must include these comprehensive sections:

### **CLI Usage Examples Section**
```markdown
## 🚀 Usage Examples

### Basic Usage
```bash
# Start on default port 8000
claude-wrapper

# Custom port (two ways)
claude-wrapper 3000
claude-wrapper --port 3000

# Skip API protection prompt
claude-wrapper --no-interactive
```

### Development & Debugging
```bash
# Verbose logging
claude-wrapper --verbose

# Debug mode with verbose
claude-wrapper --debug --verbose

# Custom port with debugging
claude-wrapper --port 8080 --debug --verbose
```

### Daemon Mode (Background Server)
```bash
# Start background server
claude-wrapper --start

# Start background with custom port
claude-wrapper --start --port 3000

# Check if running
claude-wrapper --status

# Stop background server
claude-wrapper --stop
```

### Real-World Scenarios
```bash
# Production server
claude-wrapper --port 80 --no-interactive

# Development with debug
claude-wrapper 8080 --debug --verbose

# Secure remote server
claude-wrapper --port 443
# (then answer 'y' to API protection prompt)
```

### **Tools-First Approach Section** 
Based on the OpenAI Tools API Plan, this project implements OpenAI Tools API (user-defined functions), NOT Claude Code CLI tools:

```markdown
## 🛠️ Tools-First Philosophy

Claude Wrapper embraces the **OpenAI Tools API specification** with full user-defined function support:

### What This Means
- **User-Defined Functions**: You define tools that Claude can call
- **Client-Side Execution**: Tools execute in YOUR environment, not on the server
- **Security First**: No server-side file access or command execution
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

### How It Works
1. **Define Tools**: Create function definitions with JSON schemas
2. **Claude Calls**: Claude decides when and how to call your tools
3. **You Execute**: Your client receives tool calls and executes them locally
4. **Return Results**: Send results back to Claude for continued conversation

### Example Tools You Can Define
- File operations (read/write files in your project)
- API calls to your services
- Database queries
- System commands
- Custom business logic
- Integration with your development tools

This approach gives you **maximum flexibility** while maintaining **security** - Claude gets the power of tools without server-side execution risks.
```

### **API Protection vs Authentication Section**
```markdown
## 🔐 Understanding Authentication vs API Protection

### Claude Authentication (Required)
- **Purpose**: Authenticate with Claude services (Anthropic/Bedrock/Vertex)
- **Required**: Yes, or the server won't work
- **Setup**: Environment variables before starting

### API Protection (Optional)
- **Purpose**: Protect your local server endpoints with Bearer tokens
- **Required**: No, purely optional
- **Setup**: Interactive prompt when starting server
```

## CRITICAL MISTAKES TO AVOID

❌ **NEVER use fake repository URLs** like "your-org/claude-wrapper"
❌ **NEVER document `node app/dist/cli.js`** - users don't run it that way
❌ **NEVER document `npm start`** - that's not how CLIs work
❌ **NEVER assume CLI options** - get them from actual help output
❌ **NEVER remove existing usage examples** without understanding what they do
❌ **NEVER skip showing the actual interactive prompts** users will see
❌ **NEVER assume what "tools-first" means** - it's OpenAI Tools API (user-defined), NOT Claude Code CLI tools
❌ **NEVER say "Claude Code tools enabled"** - the wrapper supports OpenAI Tools API specification
❌ **NEVER confuse API protection with Claude authentication** - they're different things

## REQUIRED SECTIONS CHECKLIST

### **📋 Structure Requirements**

✅ **Tools-First Philosophy** - Marketing copy at the top, explaining OpenAI Tools API value
✅ **Key Features** - Brief overview after tools philosophy
✅ **Installation** (npm install -g claude-wrapper)
✅ **Quick Start** with actual interactive prompts shown
✅ **CLI Usage Examples** with all flag combinations and real-world scenarios
✅ **Authentication Methods** (all 4: Anthropic/Bedrock/Vertex/CLI)
✅ **OpenAI Tools API Examples** - Detailed technical examples (after auth, not in quick start)
✅ **All CLI Options** with practical usage examples
✅ **Daemon Mode Examples** with actual command output
✅ **Development Setup** - Single comprehensive section (no duplication)
✅ **Production Deployment** with Docker and environment setup

### **📐 Content Requirements** 

✅ **Real Repository URL** - Use `git remote -v`, not fake URLs
✅ **Actual CLI Help Output** - Copy exact `claude-wrapper --help` output
✅ **Interactive Prompts Shown** - Show the actual API protection prompt users see
✅ **Authentication vs API Protection** - Clear distinction between required vs optional
✅ **Project Structure Link** - Link to `docs/PROJECT_STRUCTURE.md`, don't make up file trees
✅ **NPM Badges** - Proper npm, license, Node.js version badges
✅ **OpenAI Tools API Focus** - User-defined functions with client-side execution
✅ **Security Emphasis** - Highlight client-side execution, no server-side tool risks

### **🚫 Structure DON'Ts**

❌ **DON'T put detailed examples in Quick Start** - Keep Quick Start simple
❌ **DON'T duplicate development sections** - One comprehensive Development section
❌ **DON'T bury tools-first philosophy** - Put marketing copy prominently at top
❌ **DON'T make up project structure** - Link to actual documentation
❌ **DON'T mix authentication concepts** - Keep Claude auth separate from API protection

### **📏 Flow Requirements**

1. **Tools-First Philosophy** (marketing)
2. **Key Features** (overview)  
3. **Installation & Quick Start** (get running)
4. **CLI Usage Examples** (day-to-day usage)
5. **Authentication** (required setup)
6. **Tools API Examples** (detailed technical)
7. **Reference sections** (configuration, deployment)

This guide forces you to actually understand the codebase before writing documentation.