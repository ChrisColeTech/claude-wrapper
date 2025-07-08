# Phase 06: Port Forwarder Tests

**Goal**: Create comprehensive tests for WSL port forwarding with externalized mocks  
**Complete Feature**: Complete port forwarding test suite with externalized mock architecture  
**Dependencies**: Phase 05 must be 100% complete with all tests passing
**Reference Implementation**: tests/mocks/utils/ directory, port forwarding mock patterns
**Performance Requirement**: Test execution time <6 seconds for all port forwarder tests

### Files to Create/Update

```
CREATE NEW TEST FILES:
- tests/unit/utils/port-forwarder.test.ts - Port forwarding comprehensive tests

CREATE NEW MOCK FILES:
- tests/mocks/utils/port-forwarder-powershell-mock.ts - PowerShell command execution
- tests/mocks/utils/port-forwarder-network-mock.ts - Network port operations

CREATE NEW MOCK TEST FILES:
- tests/mocks/process/ - tests for the mocks to ensure the mocks works as expected
- tests/mocks/utils/- tests for the mocks to ensure the mocks works as expected

EXTERNAL DEPENDENCIES TO MOCK:
- Must be investigated before starting the phase
- Check for reusable existing "external dependency" mock implementations in tests

TEST COVERAGE:
- WSL port forwarding setup and teardown procedures
- PowerShell command generation and execution
- Port availability checking and validation
- Error handling for PowerShell failures
- Bulk forwarding operations and management
```

### What Gets Implemented

- Create comprehensive port forwarder tests with externalized mocks
- Implement PowerShell command execution simulation and testing
- Add network port operation mocking and validation
- Test port forwarding setup and teardown procedures
- Implement error handling for PowerShell and network operations
- Create reusable port forwarding mock utilities for consistent testing
- Add bulk operation testing and management validation
- Ensure no inline mocks within test files

### Architecture Compliance Requirements (MANDATORY)

- **Externalized Mock Architecture**: All mocks must be in separate files under `tests/mocks/`
- **No Inline Mocks**: Zero `jest.mock()` calls within test files
- **Reusable Mock Utilities**: Common mock patterns extracted to utilities
- **Mock Requirements**: PowerShell execution mocks, network port operation mocks
- **Test Coverage**: Port forwarder, PowerShell operations, network management, error handling edge cases
- **Mock Files**: tests/mocks/utils/port-forwarder-powershell-mock.ts, tests/mocks/utils/port-forwarder-network-mock.ts
- **Test Files**: tests/unit/utils/port-forwarder.test.ts
- **Error Scenarios**: PowerShell execution failures, port conflicts, network errors
- **Feature Type**: port forwarding testing

### Testing Requirements (MANDATORY)

- **100% test passing** for all port forwarding testing logic before proceeding to next phase
- **Externalized mocks only**: No inline mocking within test files
- **Mock organization**: All mocks properly organized in `tests/mocks/` directory
- **TypeScript strict**: All test and mock files pass strict TypeScript compilation
- **Performance**: Test execution time <6 seconds for all port forwarder tests

### Quality Gates for Phase 06 Completion

- ✅ All tests pass with externalized mock architecture
- ✅ No inline mocks present in test files
- ✅ Mock utilities are reusable and well-documented
- ✅ TypeScript strict mode passes for all test and mock files
- ✅ Test coverage meets requirements
- ✅ Performance requirements met (Test execution time <6 seconds for all port forwarder tests)
- ✅ Error scenarios properly tested

### Mock Architecture Requirements

- **Mock File Organization**: tests/mocks/utils/port-forwarder-powershell-mock.ts, tests/mocks/utils/port-forwarder-network-mock.ts
- **Mock Setup Functions**: Each mock file exports setup/reset/create functions
- **Mock Utilities**: Reusable mock patterns for consistent testing
- **Type Safety**: Full TypeScript support for all mock interfaces
- **Performance**: Minimal impact from mock setup/teardown

### Testable Features

{{TESTABLE_FEATURES}}

- **Ready for immediate verification** with port forwarding testing test execution
