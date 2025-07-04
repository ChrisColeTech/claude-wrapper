"use strict";
/**
 * Google Cloud Vertex AI authentication provider
 * Based on Python auth.py VertexAuth class
 *
 * Single Responsibility: Handle Google Cloud Vertex AI authentication
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
exports.VertexProvider = void 0;
var interfaces_1 = require("../interfaces");
var logger_1 = require("../../utils/logger");
var fs_1 = require("fs");
var os_1 = require("os");
var path_1 = require("path");
var logger = (0, logger_1.getLogger)('VertexProvider');
/**
 * Google Cloud Vertex AI authentication provider
 */
var VertexProvider = /** @class */ (function () {
    function VertexProvider() {
    }
    /**
     * Validate Google Cloud Vertex AI authentication configuration
     */
    VertexProvider.prototype.validate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errors, config, credentialsPath, hasCredentialsFile, hasGcloudCredentials, project, isValid;
            return __generator(this, function (_a) {
                errors = [];
                config = {};
                credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                hasCredentialsFile = credentialsPath && (0, fs_1.existsSync)(credentialsPath);
                hasGcloudCredentials = this.hasGcloudCredentials();
                config.has_credentials_file = !!hasCredentialsFile;
                config.has_gcloud_credentials = hasGcloudCredentials;
                if (hasCredentialsFile) {
                    logger.debug("Google credentials file found: ".concat(credentialsPath));
                    config.auth_method = 'service_account';
                    config.credentials_path = credentialsPath;
                }
                else if (hasGcloudCredentials) {
                    logger.debug('Google credentials found via gcloud CLI');
                    config.auth_method = 'gcloud';
                }
                else {
                    errors.push('No Google Cloud credentials found (need GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)');
                }
                project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
                if (!project) {
                    errors.push('Google Cloud project not configured (set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT)');
                }
                else {
                    config.project = project;
                    logger.debug("Google Cloud project: ".concat(project));
                }
                isValid = errors.length === 0;
                if (isValid) {
                    logger.info('Google Cloud Vertex AI authentication validated successfully');
                }
                else {
                    logger.debug("Vertex validation failed: ".concat(errors.join(', ')));
                }
                return [2 /*return*/, {
                        valid: isValid,
                        errors: errors,
                        config: config,
                        method: interfaces_1.AuthMethod.VERTEX
                    }];
            });
        });
    };
    /**
     * Get authentication method type
     */
    VertexProvider.prototype.getMethod = function () {
        return interfaces_1.AuthMethod.VERTEX;
    };
    /**
     * Get required environment variables for this provider
     */
    VertexProvider.prototype.getRequiredEnvVars = function () {
        return ['GOOGLE_APPLICATION_CREDENTIALS', 'GCLOUD_PROJECT'];
    };
    /**
     * Check if this provider is configured
     */
    VertexProvider.prototype.isConfigured = function () {
        // Has service account credentials file
        var credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        var hasServiceAccount = credentialsPath && (0, fs_1.existsSync)(credentialsPath);
        // Has gcloud credentials
        var hasGcloud = this.hasGcloudCredentials();
        return !!(hasServiceAccount || hasGcloud);
    };
    /**
     * Detect if this provider should be used based on environment
     */
    VertexProvider.prototype.canDetect = function () {
        // Auto-detect if Google Cloud credentials are available
        return this.isConfigured();
    };
    /**
     * Check if gcloud credentials exist
     */
    VertexProvider.prototype.hasGcloudCredentials = function () {
        try {
            // Check for gcloud configuration directory
            var gcloudConfigDir = (0, path_1.join)((0, os_1.homedir)(), '.config', 'gcloud');
            var credentialsFile = (0, path_1.join)(gcloudConfigDir, 'application_default_credentials.json');
            return (0, fs_1.existsSync)(credentialsFile);
        }
        catch (error) {
            logger.debug("Error checking gcloud credentials: ".concat(error));
            return false;
        }
    };
    return VertexProvider;
}());
exports.VertexProvider = VertexProvider;
