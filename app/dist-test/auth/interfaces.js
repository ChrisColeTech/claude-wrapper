"use strict";
/**
 * Authentication interfaces and types
 * Based on Python auth.py authentication system
 *
 * Single Responsibility: Authentication type definitions and contracts
 */
exports.__esModule = true;
exports.AuthMethod = void 0;
/**
 * Supported authentication methods matching Python implementation
 */
var AuthMethod;
(function (AuthMethod) {
    AuthMethod["ANTHROPIC"] = "anthropic";
    AuthMethod["BEDROCK"] = "bedrock";
    AuthMethod["VERTEX"] = "vertex";
    AuthMethod["CLAUDE_CLI"] = "claude_cli";
})(AuthMethod = exports.AuthMethod || (exports.AuthMethod = {}));
