"use strict";
/**
 * AWS Bedrock authentication provider
 * Based on Python auth.py BedrockAuth class
 *
 * Single Responsibility: Handle AWS Bedrock authentication
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.BedrockProvider = void 0;
var interfaces_1 = require("../interfaces");
var logger_1 = require("../../utils/logger");
var fs_1 = require("fs");
var os_1 = require("os");
var path_1 = require("path");
var logger = (0, logger_1.getLogger)('BedrockProvider');
/**
 * AWS Bedrock authentication provider
 */
var BedrockProvider = /** @class */ (function () {
    function BedrockProvider() {
    }
    /**
     * Validate AWS Bedrock authentication configuration
     */
    BedrockProvider.prototype.validate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errors, config, hasAccessKey, hasSecretKey, hasProfile, hasCredentialsFile, region, isValid;
            return __generator(this, function (_a) {
                errors = [];
                config = {};
                hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
                hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
                hasProfile = !!process.env.AWS_PROFILE;
                hasCredentialsFile = this.hasAwsCredentialsFile();
                config.has_access_key = hasAccessKey;
                config.has_secret_key = hasSecretKey;
                config.has_profile = hasProfile;
                config.has_credentials_file = hasCredentialsFile;
                // Validate credentials configuration
                if (hasAccessKey && hasSecretKey) {
                    logger.debug('AWS credentials found via environment variables');
                    config.auth_method = 'environment';
                }
                else if (hasProfile || hasCredentialsFile) {
                    logger.debug('AWS credentials found via profile/credentials file');
                    config.auth_method = 'profile';
                }
                else {
                    errors.push('No AWS credentials found (need AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS profile)');
                }
                region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
                if (!region) {
                    errors.push('AWS_REGION environment variable not set');
                }
                else {
                    config.region = region;
                    logger.debug("AWS region: ".concat(region));
                }
                isValid = errors.length === 0;
                if (isValid) {
                    logger.info('AWS Bedrock authentication validated successfully');
                }
                else {
                    logger.debug("Bedrock validation failed: ".concat(errors.join(', ')));
                }
                return [2 /*return*/, {
                        valid: isValid,
                        errors: errors,
                        config: config,
                        method: interfaces_1.AuthMethod.BEDROCK
                    }];
            });
        });
    };
    /**
     * Get authentication method type
     */
    BedrockProvider.prototype.getMethod = function () {
        return interfaces_1.AuthMethod.BEDROCK;
    };
    /**
     * Get required environment variables for this provider
     */
    BedrockProvider.prototype.getRequiredEnvVars = function () {
        return ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'];
    };
    /**
     * Check if this provider is configured
     */
    BedrockProvider.prototype.isConfigured = function () {
        // Has explicit credentials
        var hasExplicitCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
        // Has profile configuration
        var hasProfile = !!(process.env.AWS_PROFILE || this.hasAwsCredentialsFile());
        return hasExplicitCreds || hasProfile;
    };
    /**
     * Detect if this provider should be used based on environment
     */
    BedrockProvider.prototype.canDetect = function () {
        // Auto-detect if AWS credentials are available
        return this.isConfigured();
    };
    /**
     * Check if AWS credentials file exists
     */
    BedrockProvider.prototype.hasAwsCredentialsFile = function () {
        try {
            var credentialsPath = (0, path_1.join)((0, os_1.homedir)(), '.aws', 'credentials');
            var configPath = (0, path_1.join)((0, os_1.homedir)(), '.aws', 'config');
            return (0, fs_1.existsSync)(credentialsPath) || (0, fs_1.existsSync)(configPath);
        }
        catch (error) {
            logger.debug("Error checking AWS credentials file: ".concat(error));
            return false;
        }
    };
    return BedrockProvider;
}());
exports.BedrockProvider = BedrockProvider;
