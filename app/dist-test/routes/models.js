"use strict";
/**
 * Models endpoint implementation
 * Based on Python main.py:644-656 list_models endpoint
 * Implements Phase 11A models listing requirements
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
exports.ModelsRouter = void 0;
var express_1 = require("express");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ModelsRouter');
/**
 * Models router class implementing OpenAI models endpoint
 * Based on Python list_models endpoint
 */
var ModelsRouter = /** @class */ (function () {
    function ModelsRouter() {
    }
    /**
     * Create Express router with models endpoints
     */
    ModelsRouter.createRouter = function () {
        var router = (0, express_1.Router)();
        // GET /v1/models - List available models
        router.get('/v1/models', this.listModels.bind(this));
        return router;
    };
    /**
     * List available models endpoint
     * Based on Python main.py:644-656 list_models function
     */
    ModelsRouter.listModels = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                try {
                    logger.debug('Listing available models');
                    response = {
                        object: 'list',
                        data: this.SUPPORTED_MODELS
                    };
                    logger.debug("Returning ".concat(this.SUPPORTED_MODELS.length, " models"));
                    res.json(response);
                }
                catch (error) {
                    logger.error('Error listing models:', error);
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to list models'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get specific model by ID
     * Returns model info if found, 404 if not found
     */
    ModelsRouter.getModel = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var model_id_1, model;
            return __generator(this, function (_a) {
                try {
                    model_id_1 = req.params.model_id;
                    logger.debug("Getting model info for: ".concat(model_id_1));
                    model = this.SUPPORTED_MODELS.find(function (m) { return m.id === model_id_1; });
                    if (!model) {
                        logger.warn("Model not found: ".concat(model_id_1));
                        res.status(404).json({
                            error: 'Model not found',
                            message: "Model '".concat(model_id_1, "' is not available")
                        });
                        return [2 /*return*/];
                    }
                    logger.debug("Returning model info for: ".concat(model_id_1));
                    res.json(model);
                }
                catch (error) {
                    logger.error('Error getting model:', error);
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to get model information'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if a model is supported
     */
    ModelsRouter.isModelSupported = function (modelId) {
        return this.SUPPORTED_MODELS.some(function (model) { return model.id === modelId; });
    };
    /**
     * Get list of supported model IDs
     */
    ModelsRouter.getSupportedModelIds = function () {
        return this.SUPPORTED_MODELS.map(function (model) { return model.id; });
    };
    /**
     * List of supported Claude models
     * Based on Python main.py:650-655 model list
     */
    ModelsRouter.SUPPORTED_MODELS = [
        { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
        { id: 'claude-opus-4-20250514', object: 'model', owned_by: 'anthropic' },
        { id: 'claude-3-7-sonnet-20250219', object: 'model', owned_by: 'anthropic' },
        { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic' },
        { id: 'claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic' }
    ];
    return ModelsRouter;
}());
exports.ModelsRouter = ModelsRouter;
exports["default"] = ModelsRouter;
