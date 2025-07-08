const { createAuthMiddleware, AuthErrorType } = require('./dist/auth/middleware');
const { AuthMockFactory, AuthTestUtils } = require('./tests/mocks/auth/auth-mocks');

console.log('Testing empty token behavior...');

const middleware = createAuthMiddleware({ apiKey: 'test-key' });
const { req, res, next } = AuthMockFactory.createMiddlewareSetup('');

console.log('Authorization header:', req.get('Authorization'));

middleware(req, res, next.fn);

console.log('Response status:', res.statusCode);
console.log('Response data:', JSON.stringify(res.responseData, null, 2));
console.log('Error type:', res.responseData?.error?.code);
console.log('Expected MALFORMED_HEADER:', AuthErrorType.MALFORMED_HEADER);
console.log('Match:', res.responseData?.error?.code === AuthErrorType.MALFORMED_HEADER);

// Test the validation function
const result = AuthTestUtils.validateAuthError(
  res, 
  401, 
  'authentication_error', 
  AuthErrorType.MALFORMED_HEADER
);
console.log('validateAuthError result:', result);