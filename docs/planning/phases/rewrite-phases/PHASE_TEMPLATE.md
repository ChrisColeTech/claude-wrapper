# Phase {{PHASE_NUMBER}}A & {{PHASE_NUMBER}}B: {{PHASE_TITLE}}

## Phase {{PHASE_NUMBER}}A: {{PHASE_TITLE}} Implementation

**Goal**: {{PHASE_GOAL}}  
**Complete Feature**: {{COMPLETE_FEATURE}}  
**Dependencies**: Phase {{PREV_PHASE}}B must be 100% complete with all tests passing
**Reference Implementation**: {{REFERENCE_IMPLEMENTATION}}
**Performance Requirement**: {{PERFORMANCE_REQUIREMENT}}

### Files to Create/Update

```
{{FILES_TO_CREATE}}
```

### What Gets Implemented

{{IMPLEMENTATION_DETAILS}}

### Architecture Compliance Requirements (MANDATORY)

- **SOLID Principles**:
  - **SRP**: {{SRP_REQUIREMENT}}
  - **OCP**: Extensible for new {{EXTENSION_TYPE}} via strategy pattern
  - **LSP**: All {{COMPONENT_TYPE}} implement {{INTERFACE_NAME}} interface consistently
  - **ISP**: Separate interfaces for {{INTERFACE_LIST}}
  - **DIP**: Depend on {{DEPENDENCY_ABSTRACTIONS}} from prior phases
- **File Size Limits**: All files <200 lines, functions <50 lines, max 5 parameters
- **DRY Compliance**: Extract common {{PATTERN_TYPE}} patterns to {{UTILS_NAME}}
- **No Magic {{MAGIC_TYPE}}**: All {{CONSTANT_TYPE}} in app/src/config/constants.ts
- **Error Handling**: Consistent {{ERROR_TYPE}} with specific {{ERROR_INFO}}
- **TypeScript Strict**: All {{COMPONENT_TYPE}} code passes strict TypeScript compilation
- **Interface Design**: Maximum 5 methods per interface, single-purpose interfaces

### Anti-Pattern Prevention (MANDATORY)

- **No God Classes**: {{MAIN_CLASS}} <200 lines, focused on {{FOCUS_AREA}} only
- **No Deep Nesting**: Maximum 3 levels in {{LOGIC_TYPE}} logic, use early returns
- **No Inline Complex Logic**: Extract {{RULE_TYPE}} rules to named methods
- **No Hardcoded Values**: All {{CONFIG_TYPE}} in constants
- **No Magic {{MAGIC_VALUES}}**: Use {{CONSTANT_EXAMPLES}}

### Testing Requirements (MANDATORY)

- **100% test passing** for all {{FEATURE_TYPE}} logic before proceeding to Phase {{PHASE_NUMBER}}B
- **Unit tests**: {{UNIT_TEST_COVERAGE}}
- **Integration tests**: {{INTEGRATION_TEST_COVERAGE}}
- **Mock objects**: {{MOCK_REQUIREMENTS}}
- **Error scenario tests**: {{ERROR_SCENARIOS}}
- **Performance tests**: {{PERFORMANCE_TESTS}}

### Quality Gates for Phase {{PHASE_NUMBER}}A Completion

- ✅ All SOLID principles followed (verified via code review checklist)
- ✅ No anti-patterns present (ESLint max-lines, complexity, depth rules pass)
- ✅ 100% test passing achieved (Jest passing report)
- ✅ **All tests must pass** before proceeding to Phase {{PHASE_NUMBER}}B (unit + integration + performance)
- ✅ TypeScript strict mode passes (tsc --strict --noEmit)
- ✅ ESLint passes without warnings (npm run lint)
- ✅ {{FEATURE_TYPE}} demonstrable (integration test passing)
- ✅ Original project compatibility verified ({{COMPATIBILITY_REQUIREMENT}})
- ✅ Performance criteria met ({{PERFORMANCE_CRITERIA}})

### Original Project Compatibility Verification

{{COMPATIBILITY_CHECKLIST}}

### Testable Features

{{TESTABLE_FEATURES}}

- **Ready for immediate demonstration** with {{DEMO_TYPE}} examples

---

## Phase {{PHASE_NUMBER}}B: {{PHASE_TITLE}} - Comprehensive Review

**Goal**: Ensure 100% {{FEATURE_TYPE}} compatibility and production-quality implementation
**Review Focus**: {{REVIEW_FOCUS}}
**Dependencies**: Phase {{PHASE_NUMBER}}A must be 100% complete with all tests passing
**Reference Standards**: `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, original claude-wrapper project

### Comprehensive Review Requirements (MANDATORY)

#### 1. {{AUDIT_TITLE}} Audit

{{AUDIT_REQUIREMENTS}}

#### 2. Test Quality Review

- **Replace ALL placeholder tests** with real {{FEATURE_TYPE}} functionality tests
  {{TEST_REVIEW_REQUIREMENTS}}

#### 3. Integration Validation

{{INTEGRATION_VALIDATION}}

#### 4. Architecture Compliance Review

- **Single Responsibility**: {{COMPONENT_TYPE}} components have single purposes
- **Dependency Injection**: {{MAIN_CLASS}} depend on abstractions, not concrete implementations
- **Interface Segregation**: {{INTERFACE_LIST}} interfaces are focused (max 5 methods)
- **Error Handling**: Consistent {{ERROR_TYPE}} formatting
- **File Size Compliance**: All files under 200 lines, functions under 50 lines
- **DRY Compliance**: No duplicate {{LOGIC_TYPE}} logic

#### 5. Performance Validation

{{PERFORMANCE_VALIDATION}}

#### 6. Documentation Review

{{DOCUMENTATION_REVIEW}}

### Quality Gates for Phase {{PHASE_NUMBER}}B Completion

- ✅ **100% {{FEATURE_TYPE}} functionality verified**
- ✅ **All {{FEATURE_TYPE}} tests are comprehensive and production-ready** - no placeholders
- ✅ **{{FEATURE_TYPE}} integrates correctly** with {{INTEGRATION_TARGET}}
- ✅ **Architecture compliance achieved** - SOLID/DRY principles followed, ESLint passes
- ✅ **Performance validation completed** - all speed requirements met ({{PERFORMANCE_CRITERIA}})
- ✅ **All tests must pass** before proceeding to Phase {{NEXT_PHASE}}A (unit + integration + performance)
- ✅ **Documentation accuracy verified** - all docs reflect actual implementation

### Failure Criteria (Phase {{PHASE_NUMBER}}B Must Restart)

{{FAILURE_CRITERIA}}