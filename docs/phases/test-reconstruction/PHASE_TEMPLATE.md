# Phase {{PHASE_NUMBER}}: {{PHASE_TITLE}}

**Goal**: {{PHASE_GOAL}}  
**Complete Feature**: {{COMPLETE_FEATURE}}  
**Dependencies**: Phase {{PREV_PHASE}} must be 100% complete with all tests passing
**Reference Implementation**: {{REFERENCE_IMPLEMENTATION}}
**Performance Requirement**: {{PERFORMANCE_REQUIREMENT}}

### Files to Create/Update

```
{{FILES_TO_CREATE}}
```

### What Gets Implemented

{{IMPLEMENTATION_DETAILS}}

### Architecture Compliance Requirements (MANDATORY)

- **Externalized Mock Architecture**: All mocks must be in separate files under `tests/mocks/`
- **No Inline Mocks**: Zero `jest.mock()` calls within test files
- **Reusable Mock Utilities**: Common mock patterns extracted to utilities
- **Mock Requirements**: {{MOCK_REQUIREMENTS}}
- **Test Coverage**: {{TEST_COVERAGE}}
- **Mock Files**: {{MOCK_FILES}}
- **Test Files**: {{TEST_FILES}}
- **Error Scenarios**: {{ERROR_SCENARIOS}}
- **Feature Type**: {{FEATURE_TYPE}}

### Testing Requirements (MANDATORY)

- **100% test passing** for all {{FEATURE_TYPE}} logic before proceeding to next phase
- **Externalized mocks only**: No inline mocking within test files
- **Mock organization**: All mocks properly organized in `tests/mocks/` directory
- **TypeScript strict**: All test and mock files pass strict TypeScript compilation
- **Performance**: {{PERFORMANCE_REQUIREMENT}}

### Quality Gates for Phase {{PHASE_NUMBER}} Completion

- ✅ All tests pass with externalized mock architecture
- ✅ No inline mocks present in test files
- ✅ Mock utilities are reusable and well-documented
- ✅ TypeScript strict mode passes for all test and mock files
- ✅ Test coverage meets requirements
- ✅ Performance requirements met ({{PERFORMANCE_REQUIREMENT}})
- ✅ Error scenarios properly tested

### Mock Architecture Requirements

- **Mock File Organization**: {{MOCK_FILES}}
- **Mock Setup Functions**: Each mock file exports setup/reset/create functions
- **Mock Utilities**: Reusable mock patterns for consistent testing
- **Type Safety**: Full TypeScript support for all mock interfaces
- **Performance**: Minimal impact from mock setup/teardown

### Testable Features

{{TESTABLE_FEATURES}}

- **Ready for immediate verification** with {{FEATURE_TYPE}} test execution