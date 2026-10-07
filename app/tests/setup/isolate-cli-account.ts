/**
 * Test processes never read the operator's CLI account file (spec section 6, privacy): an app
 * built in a unit or integration test, `createServer()` with no deps included, looks for the
 * account in a file that does not exist, so no test arms redaction with live account values and
 * no output depends on whose machine runs the suite. A test that needs an account injects
 * `accountFile` (a temporary file holding the fixtures' placeholders). The e2e project does not
 * load this: its scenario 10 arms the real account on purpose.
 */
jest.mock('../../src/upstream/account-file', () => ({
  ...jest.requireActual('../../src/upstream/account-file'),
  cliAccountFile: () => jest.requireActual('path').join(__dirname, 'no-cli-account', '.claude.json')
}));
