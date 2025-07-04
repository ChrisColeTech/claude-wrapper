"use strict";
/**
 * Tool calling state persistence service
 * Single Responsibility: State persistence and storage only
 *
 * Handles persistent storage of tool calling state:
 * - Session state serialization and deserialization
 * - State backup and recovery operations
 * - Cross-session state persistence
 * - Storage optimization and compression
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.toolStatePersistence = exports.ToolStatePersistenceUtils = exports.ToolStatePersistence = exports.MemoryStateStorage = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolStatePersistence');
/**
 * In-memory state storage implementation
 */
var MemoryStateStorage = /** @class */ (function () {
    function MemoryStateStorage() {
        this.storage = new Map();
    }
    MemoryStateStorage.prototype.save = function (key, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    this.storage.set(key, JSON.parse(JSON.stringify(data))); // Deep clone
                    return [2 /*return*/, true];
                }
                catch (error) {
                    logger.error('Memory storage save failed', { key: key, error: error });
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    MemoryStateStorage.prototype.load = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                data = this.storage.get(key);
                return [2 /*return*/, data ? JSON.parse(JSON.stringify(data)) : null]; // Deep clone
            });
        });
    };
    MemoryStateStorage.prototype["delete"] = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.storage["delete"](key);
                return [2 /*return*/, true]; // Always return true to match expected behavior
            });
        });
    };
    MemoryStateStorage.prototype.exists = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.storage.has(key)];
            });
        });
    };
    MemoryStateStorage.prototype.list = function (prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var keys;
            return __generator(this, function (_a) {
                keys = Array.from(this.storage.keys());
                return [2 /*return*/, prefix ? keys.filter(function (key) { return key.startsWith(prefix); }) : keys];
            });
        });
    };
    MemoryStateStorage.prototype.size = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                data = this.storage.get(key);
                return [2 /*return*/, data ? JSON.stringify(data).length : 0];
            });
        });
    };
    return MemoryStateStorage;
}());
exports.MemoryStateStorage = MemoryStateStorage;
/**
 * Tool state persistence implementation
 */
var ToolStatePersistence = /** @class */ (function () {
    function ToolStatePersistence(storage, config) {
        this.storage = storage || new MemoryStateStorage();
        this.config = __assign({ enableCompression: false, maxStateSize: 10 * 1024 * 1024, backupInterval: 3600000, retentionPeriod: 7 * 24 * 3600000, enableEncryption: false }, config);
    }
    /**
     * Save session state with snapshot and metrics
     */
    ToolStatePersistence.prototype.saveSessionState = function (sessionId, snapshot, metrics) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, stateData, serializedData, _a, dataSize, saveSuccess, operationTime, error_1, operationTime, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        if (!sessionId) {
                            throw new Error('Session ID is required');
                        }
                        stateData = {
                            snapshot: snapshot,
                            metrics: metrics,
                            savedAt: Date.now(),
                            version: '1.0'
                        };
                        if (!this.config.enableCompression) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.compressData(stateData)];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = stateData;
                        _b.label = 4;
                    case 4:
                        serializedData = _a;
                        dataSize = JSON.stringify(serializedData).length;
                        if (dataSize > this.config.maxStateSize) {
                            throw new Error("State size ".concat(dataSize, " exceeds maximum ").concat(this.config.maxStateSize));
                        }
                        return [4 /*yield*/, this.storage.save(this.getStateKey(sessionId), serializedData)];
                    case 5:
                        saveSuccess = _b.sent();
                        if (!saveSuccess) {
                            throw new Error('Storage save operation failed');
                        }
                        operationTime = Date.now() - startTime;
                        logger.debug('Session state saved', {
                            sessionId: sessionId,
                            dataSize: dataSize,
                            operationTime: operationTime,
                            compressed: this.config.enableCompression
                        });
                        return [2 /*return*/, {
                                success: true,
                                operationType: 'save',
                                sessionId: sessionId,
                                bytesProcessed: dataSize,
                                operationTimeMs: operationTime
                            }];
                    case 6:
                        error_1 = _b.sent();
                        operationTime = Date.now() - startTime;
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        logger.error('Failed to save session state', {
                            sessionId: sessionId,
                            error: errorMessage,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: false,
                                operationType: 'save',
                                sessionId: sessionId,
                                bytesProcessed: 0,
                                operationTimeMs: operationTime,
                                error: errorMessage
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load session state with snapshot and metrics
     */
    ToolStatePersistence.prototype.loadSessionState = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var stateData, decompressedData, _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        if (!sessionId) {
                            return [2 /*return*/, { snapshot: null, metrics: null }];
                        }
                        return [4 /*yield*/, this.storage.load(this.getStateKey(sessionId))];
                    case 1:
                        stateData = _b.sent();
                        if (!stateData) {
                            return [2 /*return*/, { snapshot: null, metrics: null }];
                        }
                        if (!this.config.enableCompression) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.decompressData(stateData)];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = stateData;
                        _b.label = 4;
                    case 4:
                        decompressedData = _a;
                        logger.debug('Session state loaded', {
                            sessionId: sessionId,
                            hasSnapshot: !!decompressedData.snapshot,
                            hasMetrics: !!decompressedData.metrics
                        });
                        return [2 /*return*/, {
                                snapshot: decompressedData.snapshot || null,
                                metrics: decompressedData.metrics || null
                            }];
                    case 5:
                        error_2 = _b.sent();
                        logger.error('Failed to load session state', {
                            sessionId: sessionId,
                            error: error_2 instanceof Error ? error_2.message : String(error_2)
                        });
                        return [2 /*return*/, { snapshot: null, metrics: null }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get persisted tool call data
     */
    ToolStatePersistence.prototype.getToolCallData = function (toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.storage.load("toolcall:".concat(toolCallId))];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, data || {
                                isPersisted: false,
                                toolCallId: toolCallId,
                                lastPersisted: null
                            }];
                    case 2:
                        error_3 = _a.sent();
                        logger.warn('Failed to get tool call data', { toolCallId: toolCallId, error: error_3 });
                        return [2 /*return*/, {
                                isPersisted: false,
                                toolCallId: toolCallId,
                                lastPersisted: null,
                                error: error_3 instanceof Error ? error_3.message : String(error_3)
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create backup of session state
     */
    ToolStatePersistence.prototype.backupSessionState = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, snapshot, metrics, backupId, backupData, serializedData, dataSize, saveSuccess, metadata, operationTime, error_4, operationTime, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.loadSessionState(sessionId)];
                    case 2:
                        _a = _b.sent(), snapshot = _a.snapshot, metrics = _a.metrics;
                        if (!snapshot) {
                            throw new Error("No state found for session ".concat(sessionId));
                        }
                        backupId = this.generateBackupId(sessionId);
                        backupData = {
                            backupId: backupId,
                            sessionId: sessionId,
                            snapshot: snapshot,
                            metrics: metrics,
                            timestamp: Date.now(),
                            version: '1.0'
                        };
                        serializedData = JSON.stringify(backupData);
                        dataSize = serializedData.length;
                        return [4 /*yield*/, this.storage.save(this.getBackupKey(sessionId, backupId), backupData)];
                    case 3:
                        saveSuccess = _b.sent();
                        if (!saveSuccess) {
                            throw new Error('Backup save operation failed');
                        }
                        metadata = {
                            backupId: backupId,
                            sessionId: sessionId,
                            timestamp: Date.now(),
                            stateCount: snapshot.totalCalls,
                            sizeBytes: dataSize,
                            compressionRatio: 1.0,
                            checksum: this.calculateChecksum(serializedData)
                        };
                        return [4 /*yield*/, this.storage.save(this.getBackupMetadataKey(sessionId, backupId), metadata)];
                    case 4:
                        _b.sent();
                        operationTime = Date.now() - startTime;
                        logger.info('Session state backed up', {
                            sessionId: sessionId,
                            backupId: backupId,
                            dataSize: dataSize,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: true,
                                operationType: 'backup',
                                sessionId: sessionId,
                                bytesProcessed: dataSize,
                                operationTimeMs: operationTime
                            }];
                    case 5:
                        error_4 = _b.sent();
                        operationTime = Date.now() - startTime;
                        errorMessage = error_4 instanceof Error ? error_4.message : String(error_4);
                        logger.error('Failed to backup session state', {
                            sessionId: sessionId,
                            error: errorMessage,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: false,
                                operationType: 'backup',
                                sessionId: sessionId,
                                bytesProcessed: 0,
                                operationTimeMs: operationTime,
                                error: errorMessage
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Restore session state from backup
     */
    ToolStatePersistence.prototype.restoreSessionState = function (sessionId, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, backups, targetBackup, backupData, dataChecksum, restoreResult, operationTime, error_5, operationTime, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.listBackups(sessionId)];
                    case 2:
                        backups = _a.sent();
                        if (backups.length === 0) {
                            throw new Error("No backups found for session ".concat(sessionId));
                        }
                        targetBackup = backups[0];
                        if (options.targetTimestamp) {
                            targetBackup = backups.reduce(function (closest, backup) {
                                return Math.abs(backup.timestamp - options.targetTimestamp) <
                                    Math.abs(closest.timestamp - options.targetTimestamp) ? backup : closest;
                            });
                        }
                        return [4 /*yield*/, this.storage.load(this.getBackupKey(sessionId, targetBackup.backupId))];
                    case 3:
                        backupData = _a.sent();
                        if (!backupData) {
                            throw new Error("Backup data not found for backup ".concat(targetBackup.backupId));
                        }
                        // Validate backup data structure
                        if (!backupData.snapshot || typeof backupData.snapshot !== 'object') {
                            throw new Error('Corrupted backup data: invalid snapshot structure');
                        }
                        // Validate integrity if requested
                        if (options.validateIntegrity) {
                            dataChecksum = this.calculateChecksum(JSON.stringify(backupData));
                            if (dataChecksum !== targetBackup.checksum) {
                                throw new Error('Backup integrity validation failed');
                            }
                        }
                        return [4 /*yield*/, this.saveSessionState(sessionId, backupData.snapshot, options.includeMetrics ? backupData.metrics : undefined)];
                    case 4:
                        restoreResult = _a.sent();
                        if (!restoreResult.success) {
                            throw new Error("Failed to restore state: ".concat(restoreResult.error));
                        }
                        operationTime = Date.now() - startTime;
                        logger.info('Session state restored', {
                            sessionId: sessionId,
                            backupId: targetBackup.backupId,
                            backupTimestamp: targetBackup.timestamp,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: true,
                                operationType: 'restore',
                                sessionId: sessionId,
                                bytesProcessed: targetBackup.sizeBytes,
                                operationTimeMs: operationTime
                            }];
                    case 5:
                        error_5 = _a.sent();
                        operationTime = Date.now() - startTime;
                        errorMessage = error_5 instanceof Error ? error_5.message : String(error_5);
                        logger.error('Failed to restore session state', {
                            sessionId: sessionId,
                            error: errorMessage,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: false,
                                operationType: 'restore',
                                sessionId: sessionId,
                                bytesProcessed: 0,
                                operationTimeMs: operationTime,
                                error: errorMessage
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List available backups
     */
    ToolStatePersistence.prototype.listBackups = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var prefix, metadataKeys, backups, _i, metadataKeys_1, key, metadata, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        prefix = sessionId ? "backup:metadata:".concat(sessionId, ":") : 'backup:metadata:';
                        return [4 /*yield*/, this.storage.list(prefix)];
                    case 1:
                        metadataKeys = _a.sent();
                        backups = [];
                        _i = 0, metadataKeys_1 = metadataKeys;
                        _a.label = 2;
                    case 2:
                        if (!(_i < metadataKeys_1.length)) return [3 /*break*/, 5];
                        key = metadataKeys_1[_i];
                        return [4 /*yield*/, this.storage.load(key)];
                    case 3:
                        metadata = _a.sent();
                        if (metadata) {
                            backups.push(metadata);
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, backups.sort(function (a, b) { return b.timestamp - a.timestamp; })];
                    case 6:
                        error_6 = _a.sent();
                        logger.error('Failed to list backups', {
                            sessionId: sessionId,
                            error: error_6 instanceof Error ? error_6.message : String(error_6)
                        });
                        return [2 /*return*/, []];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean up expired states and backups
     */
    ToolStatePersistence.prototype.cleanupExpiredStates = function (maxAgeMs) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, cutoffTime, cleanedCount, totalBytes, stateKeys, _i, stateKeys_1, key, data, size, backupKeys, _a, backupKeys_1, key, data, size, metadataKeys, _b, metadataKeys_2, key, metadata, operationTime, error_7, operationTime, errorMessage;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = Date.now();
                        cutoffTime = Date.now() - maxAgeMs;
                        cleanedCount = 0;
                        totalBytes = 0;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 22, , 23]);
                        return [4 /*yield*/, this.storage.list('state:')];
                    case 2:
                        stateKeys = _c.sent();
                        _i = 0, stateKeys_1 = stateKeys;
                        _c.label = 3;
                    case 3:
                        if (!(_i < stateKeys_1.length)) return [3 /*break*/, 8];
                        key = stateKeys_1[_i];
                        return [4 /*yield*/, this.storage.load(key)];
                    case 4:
                        data = _c.sent();
                        if (!(data && data.savedAt <= cutoffTime)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.storage.size(key)];
                    case 5:
                        size = _c.sent();
                        return [4 /*yield*/, this.storage["delete"](key)];
                    case 6:
                        _c.sent();
                        cleanedCount++;
                        totalBytes += size;
                        _c.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8: return [4 /*yield*/, this.storage.list('backup:')];
                    case 9:
                        backupKeys = _c.sent();
                        _a = 0, backupKeys_1 = backupKeys;
                        _c.label = 10;
                    case 10:
                        if (!(_a < backupKeys_1.length)) return [3 /*break*/, 15];
                        key = backupKeys_1[_a];
                        return [4 /*yield*/, this.storage.load(key)];
                    case 11:
                        data = _c.sent();
                        if (!(data && data.timestamp <= cutoffTime)) return [3 /*break*/, 14];
                        return [4 /*yield*/, this.storage.size(key)];
                    case 12:
                        size = _c.sent();
                        return [4 /*yield*/, this.storage["delete"](key)];
                    case 13:
                        _c.sent();
                        cleanedCount++;
                        totalBytes += size;
                        _c.label = 14;
                    case 14:
                        _a++;
                        return [3 /*break*/, 10];
                    case 15: return [4 /*yield*/, this.storage.list('backup:metadata:')];
                    case 16:
                        metadataKeys = _c.sent();
                        _b = 0, metadataKeys_2 = metadataKeys;
                        _c.label = 17;
                    case 17:
                        if (!(_b < metadataKeys_2.length)) return [3 /*break*/, 21];
                        key = metadataKeys_2[_b];
                        return [4 /*yield*/, this.storage.load(key)];
                    case 18:
                        metadata = _c.sent();
                        if (!(metadata && metadata.timestamp <= cutoffTime)) return [3 /*break*/, 20];
                        return [4 /*yield*/, this.storage["delete"](key)];
                    case 19:
                        _c.sent();
                        cleanedCount++;
                        _c.label = 20;
                    case 20:
                        _b++;
                        return [3 /*break*/, 17];
                    case 21:
                        operationTime = Date.now() - startTime;
                        logger.info('Expired states cleaned up', {
                            cleanedCount: cleanedCount,
                            totalBytes: totalBytes,
                            cutoffTime: cutoffTime,
                            operationTime: operationTime
                        });
                        return [2 /*return*/, {
                                success: true,
                                operationType: 'cleanup',
                                bytesProcessed: totalBytes,
                                operationTimeMs: operationTime,
                                cleanedEntries: cleanedCount
                            }];
                    case 22:
                        error_7 = _c.sent();
                        operationTime = Date.now() - startTime;
                        errorMessage = error_7 instanceof Error ? error_7.message : String(error_7);
                        logger.error('Failed to cleanup expired states', {
                            error: errorMessage,
                            operationTime: operationTime
                        });
                        // Throw the error for critical storage failures
                        throw error_7;
                    case 23: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get storage statistics
     */
    ToolStatePersistence.prototype.getStorageStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stateKeys, totalSizeBytes, oldestState, _i, stateKeys_2, key, size, data, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, this.storage.list('state:')];
                    case 1:
                        stateKeys = _a.sent();
                        totalSizeBytes = 0;
                        oldestState = Date.now();
                        _i = 0, stateKeys_2 = stateKeys;
                        _a.label = 2;
                    case 2:
                        if (!(_i < stateKeys_2.length)) return [3 /*break*/, 6];
                        key = stateKeys_2[_i];
                        return [4 /*yield*/, this.storage.size(key)];
                    case 3:
                        size = _a.sent();
                        totalSizeBytes += size;
                        return [4 /*yield*/, this.storage.load(key)];
                    case 4:
                        data = _a.sent();
                        if (data && data.savedAt < oldestState) {
                            oldestState = data.savedAt;
                        }
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/, {
                            totalSessions: stateKeys.length,
                            totalSizeBytes: totalSizeBytes,
                            oldestState: stateKeys.length > 0 ? oldestState : 0
                        }];
                    case 7:
                        error_8 = _a.sent();
                        logger.error('Failed to get storage stats', {
                            error: error_8 instanceof Error ? error_8.message : String(error_8)
                        });
                        return [2 /*return*/, { totalSessions: 0, totalSizeBytes: 0, oldestState: 0 }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate storage keys
     */
    ToolStatePersistence.prototype.getStateKey = function (sessionId) {
        return "state:".concat(sessionId);
    };
    ToolStatePersistence.prototype.getBackupKey = function (sessionId, backupId) {
        return "backup:".concat(sessionId, ":").concat(backupId);
    };
    ToolStatePersistence.prototype.getBackupMetadataKey = function (sessionId, backupId) {
        return "backup:metadata:".concat(sessionId, ":").concat(backupId);
    };
    /**
     * Generate backup ID
     */
    ToolStatePersistence.prototype.generateBackupId = function (sessionId) {
        var timestamp = Date.now();
        var random = Math.random().toString(36).substring(2, 8);
        return "".concat(sessionId, "_").concat(timestamp, "_").concat(random);
    };
    /**
     * Calculate simple checksum
     */
    ToolStatePersistence.prototype.calculateChecksum = function (data) {
        var hash = 0;
        for (var i = 0; i < data.length; i++) {
            var char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    };
    /**
     * Compress data (placeholder - would use actual compression library)
     */
    ToolStatePersistence.prototype.compressData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In real implementation, would use compression library like zlib
                return [2 /*return*/, data];
            });
        });
    };
    /**
     * Decompress data (placeholder - would use actual compression library)
     */
    ToolStatePersistence.prototype.decompressData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In real implementation, would use compression library like zlib
                return [2 /*return*/, data];
            });
        });
    };
    return ToolStatePersistence;
}());
exports.ToolStatePersistence = ToolStatePersistence;
/**
 * State persistence utilities
 */
exports.ToolStatePersistenceUtils = {
    /**
     * Estimate storage size
     */
    estimateStorageSize: function (snapshot, metrics) {
        var data = { snapshot: snapshot, metrics: metrics };
        return JSON.stringify(data).length;
    },
    /**
     * Validate state data
     */
    validateStateData: function (data) {
        if (!data || !data.snapshot)
            return false;
        return typeof data.snapshot.sessionId === 'string' &&
            Array.isArray(data.snapshot.pendingCalls) &&
            Array.isArray(data.snapshot.completedCalls);
    },
    /**
     * Create state summary
     */
    createStateSummary: function (snapshot) {
        return "Session ".concat(snapshot.sessionId, ": ").concat(snapshot.totalCalls, " calls, ") +
            "".concat(snapshot.pendingCalls.length, " pending, ").concat(snapshot.completedCalls.length, " completed");
    },
    /**
     * Check if backup is recent
     */
    isRecentBackup: function (backup, maxAgeMs) {
        if (maxAgeMs === void 0) { maxAgeMs = 3600000; }
        return Date.now() - backup.timestamp <= maxAgeMs;
    }
};
exports.toolStatePersistence = new ToolStatePersistence();
