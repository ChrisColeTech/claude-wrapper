# Phase 07: CLI WSL Integration Tests

**Goal**: Create comprehensive tests for CLI WSL integration with externalized mocks  
**Complete Feature**: Complete CLI WSL integration test suite with externalized mock architecture  
**Dependencies**: Phase 06 must be 100% complete with all tests passing
**Reference Implementation**: tests/mocks/cli/ directory, CLI integration mock patterns
**Performance Requirement**: Test execution time <5 seconds for all CLI WSL integration tests

### Files to Create/Update

```
CREATE NEW TEST FILES:
- tests/unit/cli/cli-wsl.test.ts - CLI WSL integration comprehensive tests

CREATE NEW MOCK FILES:
- tests/mocks/cli/cli-wsl-integration-mock.ts - CLI and WSL integration utilities

CREATE NEW MOCK TEST FILES:
- tests/mocks/cli/ - tests for the mocks to ensure the mocks works as expected

EXTERNAL DEPENDENCIES TO MOCK:
- Must be investigated before starting the phase
- Check for reusable existing "external dependency" mock implementations in tests

TEST COVERAGE:
- WSL-specific CLI argument handling and processing
- Port forwarding CLI integration and management
- WSL environment detection in CLI context
- Error messaging for WSL scenarios and troubleshooting
```

### What Gets Implemented

- Create comprehensive CLI WSL integration tests with externalized mocks
- Implement CLI argument parsing utilities for WSL scenarios
- Add WSL detection integration and testing validation
- Test port forwarding integration and management procedures
- Implement error messaging and troubleshooting validation
- Create reusable CLI WSL mock utilities for consistent testing
- Add integration scenario testing and validation procedures
- Ensure no inline mocks within test files

### Architecture Compliance Requirements (MANDATORY)

- **Externalized Mock Architecture**: All mocks must be in separate files under `tests/mocks/`
- **No Inline Mocks**: Zero `jest.mock()` calls within test files
- **Reusable Mock Utilities**: Common mock patterns extracted to utilities
- **Mock Requirements**: CLI argument parsing mocks, WSL integration mocks, error messaging mocks
- **Test Coverage**: CLI WSL integration, argument handling, environment detection, error messaging edge cases
- **Mock Files**: tests/mocks/cli/cli-wsl-integration-mock.ts
- **Test Files**: tests/unit/cli/cli-wsl.test.ts
- **Error Scenarios**: CLI argument errors, WSL detection failures, integration issues
- **Feature Type**: CLI WSL integration testing

### Testing Requirements (MANDATORY)

- **100% test passing** for all CLI WSL integration testing logic before proceeding to next phase
- **Externalized mocks only**: No inline mocking within test files
- **Mock organization**: All mocks properly organized in `tests/mocks/` directory
- **TypeScript strict**: All test and mock files pass strict TypeScript compilation
- **Performance**: Test execution time <5 seconds for all CLI WSL integration tests

### Quality Gates for Phase 07 Completion

- ✅ All tests pass with externalized mock architecture
- ✅ No inline mocks present in test files
- ✅ Mock utilities are reusable and well-documented
- ✅ TypeScript strict mode passes for all test and mock files
- ✅ Test coverage meets requirements
- ✅ Performance requirements met (Test execution time <5 seconds for all CLI WSL integration tests)
- ✅ Error scenarios properly tested

### Mock Architecture Requirements

- **Mock File Organization**: tests/mocks/cli/cli-wsl-integration-mock.ts
- **Mock Setup Functions**: Each mock file exports setup/reset/create functions
- **Mock Utilities**: Reusable mock patterns for consistent testing
- **Type Safety**: Full TypeScript support for all mock interfaces
- **Performance**: Minimal impact from mock setup/teardown

### Testable Features

{{TESTABLE_FEATURES}}

- **Ready for immediate verification** with CLI WSL integration testing test execution
