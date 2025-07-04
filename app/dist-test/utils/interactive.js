"use strict";
/**
 * Interactive CLI prompts for API key setup
 * Based on Python main.py:60-104
 *
 * Single Responsibility: Interactive user prompts and API key setup
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
exports.displayApiKeyStatus = exports.promptForApiProtection = exports.InteractiveApiKeySetup = exports.ReadlineWrapper = void 0;
var readline_1 = require("readline");
var crypto_1 = require("./crypto");
/**
 * Wrapper for Node.js readline interface
 */
var ReadlineWrapper = /** @class */ (function () {
    function ReadlineWrapper() {
        this.rl = (0, readline_1.createInterface)({
            input: process.stdin,
            output: process.stdout
        });
    }
    ReadlineWrapper.prototype.question = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        _this.rl.question(query, function (answer) {
                            resolve(answer);
                        });
                    })];
            });
        });
    };
    ReadlineWrapper.prototype.close = function () {
        this.rl.close();
    };
    return ReadlineWrapper;
}());
exports.ReadlineWrapper = ReadlineWrapper;
/**
 * Interactive API key setup class
 */
var InteractiveApiKeySetup = /** @class */ (function () {
    function InteractiveApiKeySetup(readline) {
        this.readline = readline || new ReadlineWrapper();
    }
    /**
     * Prompt user for API key protection setup
     * Based on Python prompt_for_api_protection() function
     *
     * @param options Setup options
     * @returns API key setup result
     */
    InteractiveApiKeySetup.prototype.promptForApiProtection = function (options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, skipIfSet, _b, tokenLength, choice, normalizedChoice, apiKey;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = options.skipIfSet, skipIfSet = _a === void 0 ? true : _a, _b = options.tokenLength, tokenLength = _b === void 0 ? 32 : _b;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, , 3, 4]);
                        // Check if API_KEY is already set via environment variable
                        if (skipIfSet && process.env.API_KEY) {
                            return [2 /*return*/, {
                                    apiKey: null,
                                    userChoice: 'existing',
                                    message: 'API key already configured via environment variable'
                                }];
                        }
                        // Display information about API key protection
                        console.log('\n🔐 API Key Protection Setup');
                        console.log('━'.repeat(50));
                        console.log('You can optionally protect your API endpoints with a bearer token.');
                        console.log('This adds an extra layer of security for remote access.');
                        console.log('');
                        console.log('If enabled, clients must include: Authorization: Bearer <token>');
                        console.log('');
                        return [4 /*yield*/, this.readline.question('Would you like to enable API key protection? (y/N): ')];
                    case 2:
                        choice = _c.sent();
                        normalizedChoice = choice.toLowerCase().trim();
                        if (normalizedChoice === 'y' || normalizedChoice === 'yes') {
                            apiKey = (0, crypto_1.generateSecureToken)(tokenLength);
                            console.log('');
                            console.log('✅ API key protection enabled!');
                            console.log('━'.repeat(50));
                            console.log("\uD83D\uDD11 Your API key: ".concat(apiKey));
                            console.log('');
                            console.log('⚠️  IMPORTANT: Save this key securely!');
                            console.log('   • This key will not be shown again');
                            console.log('   • You can also set it via API_KEY environment variable');
                            console.log('   • Include it in requests: Authorization: Bearer <key>');
                            console.log('');
                            return [2 /*return*/, {
                                    apiKey: apiKey,
                                    userChoice: 'yes',
                                    message: 'API key protection enabled with generated token'
                                }];
                        }
                        else {
                            console.log('');
                            console.log('ℹ️  API key protection disabled.');
                            console.log('   Endpoints will be accessible without authentication.');
                            console.log('');
                            return [2 /*return*/, {
                                    apiKey: null,
                                    userChoice: 'no',
                                    message: 'API key protection disabled by user choice'
                                }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        this.readline.close();
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Display API key information for existing setup
     *
     * @param apiKey Existing API key (masked for security)
     */
    InteractiveApiKeySetup.prototype.displayExistingApiKeyInfo = function (apiKey) {
        console.log('\n🔐 API Key Protection Status');
        console.log('━'.repeat(50));
        console.log('✅ API key protection is ENABLED');
        console.log("\uD83D\uDD11 API key: ".concat(this.maskApiKey(apiKey)));
        console.log('');
        console.log('ℹ️  Clients must include: Authorization: Bearer <token>');
        console.log('');
    };
    /**
     * Mask API key for safe display
     *
     * @param apiKey API key to mask
     * @returns Masked API key
     */
    InteractiveApiKeySetup.prototype.maskApiKey = function (apiKey) {
        if (!apiKey || apiKey.length < 8) {
            return '***';
        }
        return "".concat(apiKey.substring(0, 3)).concat('*'.repeat(apiKey.length - 6)).concat(apiKey.substring(apiKey.length - 3));
    };
    return InteractiveApiKeySetup;
}());
exports.InteractiveApiKeySetup = InteractiveApiKeySetup;
/**
 * Convenience function for API key setup
 * Based on Python prompt_for_api_protection() function
 *
 * @param options Setup options
 * @returns Generated API key or null
 */
function promptForApiProtection(options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var setup, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup = new InteractiveApiKeySetup(options.readline);
                    return [4 /*yield*/, setup.promptForApiProtection(options)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.apiKey];
            }
        });
    });
}
exports.promptForApiProtection = promptForApiProtection;
/**
 * Display API key status information
 *
 * @param apiKey Current API key (if any)
 */
function displayApiKeyStatus(apiKey) {
    var setup = new InteractiveApiKeySetup();
    if (apiKey) {
        setup.displayExistingApiKeyInfo(apiKey);
    }
    else {
        console.log('\n🔐 API Key Protection Status');
        console.log('━'.repeat(50));
        console.log('⚪ API key protection is DISABLED');
        console.log('   Endpoints are accessible without authentication');
        console.log('');
    }
}
exports.displayApiKeyStatus = displayApiKeyStatus;
