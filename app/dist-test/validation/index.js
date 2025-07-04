"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.CompatibilityReporter = exports.HeaderProcessor = exports.ParameterValidator = void 0;
/**
 * Validation module exports
 * Based on Python parameter_validator.py
 */
var validator_1 = require("./validator");
__createBinding(exports, validator_1, "ParameterValidator");
var headers_1 = require("./headers");
__createBinding(exports, headers_1, "HeaderProcessor");
var compatibility_1 = require("./compatibility");
__createBinding(exports, compatibility_1, "CompatibilityReporter");
