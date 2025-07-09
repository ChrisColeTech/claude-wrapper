# Generic Project Requirements

This document serves as a comprehensive requirements template for greenfield application development projects.

## 🎯 Project Objective

Create a well-architected application using modern development practices. This is a greenfield project that should prioritize code quality, maintainability, and comprehensive documentation.

## 📚 Documentation Requirements

### **Documentation Folder**: `docs/`

**CRITICAL**: All documentation must be created **BEFORE** any implementation work begins.

### **Required Documents** (6 documents total):

#### **1. COMPREHENSIVE README Document**

- **Purpose**: Document ALL features and requirements for the application
- **Content Requirements**:
  - Complete feature specification
  - All functional requirements
  - Non-functional requirements (performance, security, etc.)
  - Technology stack justification
  - Integration requirements
  - Configuration options and environment variables
  - Complete compatibility and constraint analysis

#### **2. FULL Implementation Plan Document**

- **CRITICAL SPECIFICATION**: **ONE FEATURE PER PHASE**
- **What this means**:
  - Each individual feature gets its own dedicated phase
  - NOT grouping multiple features together
- **Content Requirements**:
  - Each phase focuses on ONE specific feature
  - Reference any existing systems or specifications for that feature
  - Explain how to implement that ONE feature
  - Keep implementation details separate from planning
  - NO code examples in the plan itself (they go in separate document)
  - Link to the separate code examples document

#### **3. Project Structure Document**

- **Purpose**: Serve as the centralized reference for all file organization
- **Content Requirements**:
  - Complete file and folder structure for the application
  - Clear component organization and relationships
  - Module dependencies and imports structure
  - Reference point for all other documentation

#### **4. Architecture Document**

- **SPECIFIC REQUIREMENTS**:
  - **SOLID principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
  - **DRY principle**: Don't Repeat Yourself guidelines
  - **Anti-pattern prevention**: Directives for no spaghetti code or massive monster classes
  - **Best practices**: Guidelines to follow for clean code
- **Content Requirements**:
  - Concrete examples of SOLID principles in chosen technology
  - Specific rules for preventing anti-patterns
  - Enforceable guidelines (size limits, complexity rules)
  - Code quality standards
  - Design patterns to be used
  - Technology-specific best practices

#### **5. API Reference Document**

- **Purpose**: Complete documentation of all API endpoints/interfaces
- **Content Requirements**:
  - All endpoints/public interfaces
  - Request/response formats
  - Error handling
  - Authentication/authorization requirements
  - Usage examples
  - Rate limiting and constraints

#### **6. Code Examples Document**

- **Purpose**: Provide detailed code examples for implementation patterns
- **Content Requirements**:
  - Technology-specific implementation examples
  - Common design patterns for the chosen stack
  - Implementation examples that support the implementation plan
  - Detailed code snippets showing exact approaches
- **Critical**: This document must be referenced from the implementation plan but kept separate

## 🔄 Implementation Approach Requirements

### **Development Philosophy**

- **Feature-Driven Development**: Build one complete feature at a time
- **Test-Driven Development**: Write tests before implementation
- **Documentation-First**: All features must be documented before coding
- **Quality-First**: Code quality standards are non-negotiable

### **Code Examples Separation**

**Requirements**:

1. Implementation plan should focus on planning and analysis
2. Code examples belong in a separate dedicated document
3. Link to the separate code examples document from the implementation plan
4. No extensive code blocks in planning documents

### **Architecture Focus**

**Requirements**:

1. Must include SOLID principles with concrete examples
2. Must include DRY principle guidelines
3. Must include specific anti-pattern prevention
4. Must include directives against spaghetti code
5. Must include directives against monster classes
6. Must provide enforceable best practices

## 📋 Quality Standards

### **Documentation Quality Requirements**

1. **Accuracy**: All documentation must be based on thorough analysis and research
2. **Completeness**: Cover ALL features and requirements, not just major ones
3. **Specificity**: Reference specific technologies, frameworks, and implementation details
4. **Clarity**: Use crystal clear natural language
5. **Organization**: Logical structure that's easy to follow
6. **Maintainability**: Documentation that can be easily updated as project evolves

### **Implementation Plan Specific Requirements**

1. **One Feature Per Phase**: Each phase covers exactly one feature
2. **Research-First Analysis**: Study existing solutions and best practices before planning
3. **Clear Dependencies**: Understand what each feature depends on
4. **No Code Examples**: Keep implementation details in the separate code examples document
5. **Testability**: Each feature must include testing strategy

### **Architecture Guide Specific Requirements**

1. **SOLID Principles**: Must include all 5 principles with technology-specific examples
2. **DRY Principle**: Clear guidelines for avoiding code duplication
3. **Anti-Pattern Prevention**: Specific rules against spaghetti code and monster classes
4. **Enforceable Guidelines**: Concrete size limits and complexity rules
5. **Best Practices**: Actionable guidelines for clean code
6. **Technology Alignment**: Architecture must align with chosen technology stack

### **Code Examples Document Specific Requirements**

1. **Comprehensive Coverage**: Examples for all major implementation patterns
2. **Technology-Specific Focus**: Show exact implementation approaches for chosen stack
3. **Feature-Specific Examples**: Support each phase of the implementation plan
4. **Detailed and Practical**: Real, usable code examples
5. **Pattern Library**: Reusable patterns and components

## 🚫 Common Mistakes to Avoid

1. **Don't group multiple features into single phases**
2. **Don't create documentation that ignores existing solutions and best practices**
3. **Don't put extensive code examples in planning documents**
4. **Don't create architecture guides without SOLID/DRY principles**
5. **Don't forget anti-pattern prevention guidelines**
6. **Don't create incomplete or superficial documentation**
7. **Don't mix code examples with planning documents**
8. **Don't start coding before documentation is complete**
9. **Don't ignore testing strategy in planning**
10. **Don't choose technology stack without proper justification**

## 🎯 Success Criteria

The documentation will be considered complete and correct when:

1. **All 6 documents exist** in the `docs/` folder
2. **Implementation plan has one feature per phase**
3. **Implementation plan contains no code examples** (they're in separate document)
4. **All documents reference research and best practices** rather than making assumptions
5. **Architecture guide includes SOLID/DRY principles** and anti-pattern prevention
6. **API reference covers all interfaces**
7. **Project structure provides a centralized reference** for file organization
8. **README comprehensively covers all features and requirements**
9. **Code examples document provides detailed implementation guidance**
10. **All documentation uses crystal clear natural language**

## 📝 Process Requirements

1. **Create all 6 documents in the docs folder FIRST** before any implementation work
2. **Follow the exact specifications** provided for each document
3. **Research existing solutions and best practices systematically**
4. **Keep code examples in their own separate document**
5. **Use crystal clear natural language** throughout
6. **After all docs are complete**, create the application structure and begin implementation

## 🏗️ Application Scaffolding Requirements

**After the project structure has been defined**, create an initialization shell script with the following requirements:

### **Init Script Requirements**

- **Script Name**: `init-app.sh` (to be created in `scripts/` folder in project root)
- **Purpose**: Automate complete application scaffolding based on the project structure document

### **Script Functions** (in order):

1. **Create App Folder**: Create an `app/` folder in the project root
2. **Scaffold Application Structure**: Create the entire application structure inside the `app/` folder as defined in the project structure document
3. **Initialize Package Manager**: Run initialization for chosen package manager (npm, yarn, composer, pip, etc.)
4. **Install Dependencies**: Install all required packages/libraries identified in the project structure
5. **Create Project Folders**: Create all directories specified in the project structure document
6. **Create Placeholder Files**: Create empty placeholder files for all files specified in the project structure
7. **Create Test Infrastructure**:
   - Create `tests/` folder in the app folder
   - Create subfolders for the complete test suite structure
   - Create placeholder test files
8. **Create Mock/Test Data Infrastructure**:
   - Mock any external dependencies (databases, APIs, etc.)
   - Create mock/test data structures
   - Set up the testing infrastructure

### **Expected Final Structure**:

```
project-name/
├── REQUIREMENTS.md              # This requirements document
├── docs/                        # All 6 documentation files
├── scripts/                     # Script folder
│   └── init-app.sh              # Initialization script
└── app/                         # Created by init script
    ├── package.json             # Package manager files
    ├── [entire project structure] # As defined in PROJECT_STRUCTURE.md
    └── tests/                   # Test infrastructure
        ├── unit/
        ├── integration/
        ├── mocks/               # Mock dependencies and test data
        │   ├── MockDatabase.ts
        │   └── MockAPI.ts
        └── fixtures/            # Test data files
```

### **Script Requirements**:

- **Executable**: Script must be executable (`chmod +x init-app.sh`)
- **Error Handling**: Include proper error handling for each step
- **Progress Feedback**: Show progress messages for each major step
- **Validation**: Verify each step completed successfully before proceeding
- **Idempotent**: Safe to run multiple times without breaking existing structure
- **Technology Agnostic**: Should work with any technology stack specified in requirements

## 📁 Final Documentation Structure

The completed docs folder should contain exactly these 6 files:

```
docs/
├── README.md                    # Comprehensive feature and requirements analysis
├── IMPLEMENTATION_PLAN.md       # One feature per phase (no code examples)
├── PROJECT_STRUCTURE.md         # Centralized file organization reference
├── ARCHITECTURE.md              # SOLID/DRY principles + anti-pattern prevention
├── API_REFERENCE.md             # Complete interface documentation
└── CODE_EXAMPLES.md             # Implementation pattern examples
```

## 🔧 Usage Instructions

To use this requirements template for a specific project:

1. **Copy this file** to your project root as `REQUIREMENTS.md`
2. **Customize the Project Objective** section with your specific project details
3. **Adjust technology stack references** throughout the document
4. **Modify the API Reference section** if your project doesn't have APIs
5. **Add any domain-specific requirements** to the quality standards
6. **Customize the scaffolding script** for your chosen technology stack
7. **Follow the process requirements** to create all 6 documentation files before coding

## 📝 Core Principles

This requirements template enforces:

- **Documentation-first development**
- **One feature per implementation phase**
- **Separation of planning from code examples**
- **SOLID principles and anti-pattern prevention**
- **Comprehensive project scaffolding with testing infrastructure**
- **Clean, maintainable, and well-documented codebases**
- **Quality-first development approach**

Following these requirements will result in a well-architected, maintainable, and thoroughly documented application that follows industry best practices.
