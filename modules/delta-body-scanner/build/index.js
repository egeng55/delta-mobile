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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportsARKit = exports.supportsPhotogrammetry = exports.hasLiDAR = exports.useBodyScanner = exports.Model3DViewer = exports.BodyScanner3DView = void 0;
exports.getCapabilities = getCapabilities;
exports.startLiDARScan = startLiDARScan;
exports.startPhotogrammetryScan = startPhotogrammetryScan;
exports.exportMesh = exportMesh;
exports.deleteScan = deleteScan;
exports.getScanHistory = getScanHistory;
exports.meshExists = meshExists;
exports.getMeshFileSize = getMeshFileSize;
exports.addScanProgressListener = addScanProgressListener;
exports.addScanCompleteListener = addScanCompleteListener;
exports.addScanErrorListener = addScanErrorListener;
exports.addMeshUpdateListener = addMeshUpdateListener;
var expo_modules_core_1 = require("expo-modules-core");
// Import and re-export types
__exportStar(require("./DeltaBodyScanner.types"), exports);
// Export components
var BodyScanner3DView_1 = require("./BodyScanner3DView");
Object.defineProperty(exports, "BodyScanner3DView", { enumerable: true, get: function () { return BodyScanner3DView_1.BodyScanner3DView; } });
var Model3DViewer_1 = require("./Model3DViewer");
Object.defineProperty(exports, "Model3DViewer", { enumerable: true, get: function () { return Model3DViewer_1.Model3DViewer; } });
// Export hook
var useBodyScanner_1 = require("./hooks/useBodyScanner");
Object.defineProperty(exports, "useBodyScanner", { enumerable: true, get: function () { return useBodyScanner_1.useBodyScanner; } });
// Get the native module
var DeltaBodyScanner = (0, expo_modules_core_1.requireNativeModule)('DeltaBodyScanner');
// Create event emitter
var emitter = new expo_modules_core_1.EventEmitter(DeltaBodyScanner !== null && DeltaBodyScanner !== void 0 ? DeltaBodyScanner : expo_modules_core_1.NativeModulesProxy.DeltaBodyScanner);
// Module constants (synchronous)
exports.hasLiDAR = (_a = DeltaBodyScanner === null || DeltaBodyScanner === void 0 ? void 0 : DeltaBodyScanner.hasLiDAR) !== null && _a !== void 0 ? _a : false;
exports.supportsPhotogrammetry = (_b = DeltaBodyScanner === null || DeltaBodyScanner === void 0 ? void 0 : DeltaBodyScanner.supportsPhotogrammetry) !== null && _b !== void 0 ? _b : false;
exports.supportsARKit = (_c = DeltaBodyScanner === null || DeltaBodyScanner === void 0 ? void 0 : DeltaBodyScanner.supportsARKit) !== null && _c !== void 0 ? _c : false;
// Async functions
function getCapabilities() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.getCapabilities()];
        });
    });
}
function startLiDARScan() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.startLiDARScan()];
        });
    });
}
function startPhotogrammetryScan() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.startPhotogrammetryScan()];
        });
    });
}
function exportMesh(format) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.exportMesh(format)];
        });
    });
}
function deleteScan(scanId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.deleteScan(scanId)];
        });
    });
}
function getScanHistory() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.getScanHistory()];
        });
    });
}
function meshExists(fileUri) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.meshExists(fileUri)];
        });
    });
}
function getMeshFileSize(fileUri) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, DeltaBodyScanner.getMeshFileSize(fileUri)];
        });
    });
}
// Event subscriptions
function addScanProgressListener(listener) {
    return emitter.addListener('onScanProgress', listener);
}
function addScanCompleteListener(listener) {
    return emitter.addListener('onScanComplete', listener);
}
function addScanErrorListener(listener) {
    return emitter.addListener('onScanError', listener);
}
function addMeshUpdateListener(listener) {
    return emitter.addListener('onMeshUpdate', listener);
}
// Default export for convenience
exports.default = {
    hasLiDAR: exports.hasLiDAR,
    supportsPhotogrammetry: exports.supportsPhotogrammetry,
    supportsARKit: exports.supportsARKit,
    getCapabilities: getCapabilities,
    startLiDARScan: startLiDARScan,
    startPhotogrammetryScan: startPhotogrammetryScan,
    exportMesh: exportMesh,
    deleteScan: deleteScan,
    getScanHistory: getScanHistory,
    meshExists: meshExists,
    getMeshFileSize: getMeshFileSize,
    addScanProgressListener: addScanProgressListener,
    addScanCompleteListener: addScanCompleteListener,
    addScanErrorListener: addScanErrorListener,
    addMeshUpdateListener: addMeshUpdateListener,
};
