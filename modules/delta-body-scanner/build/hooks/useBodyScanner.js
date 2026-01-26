"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBodyScanner = useBodyScanner;
var react_1 = require("react");
var index_1 = require("../index");
function useBodyScanner() {
    var _this = this;
    // Refs
    var scannerRef = (0, react_1.useRef)(null);
    // State
    var _a = (0, react_1.useState)(null), capabilities = _a[0], setCapabilities = _a[1];
    var _b = (0, react_1.useState)(true), isCapabilitiesLoading = _b[0], setIsCapabilitiesLoading = _b[1];
    var _c = (0, react_1.useState)(null), scanProgress = _c[0], setScanProgress = _c[1];
    var _d = (0, react_1.useState)(null), photogrammetryProgress = _d[0], setPhotogrammetryProgress = _d[1];
    var _e = (0, react_1.useState)(false), isScanning = _e[0], setIsScanning = _e[1];
    var _f = (0, react_1.useState)(null), scanResult = _f[0], setScanResult = _f[1];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)([]), scanHistory = _h[0], setScanHistory = _h[1];
    // Load capabilities on mount
    (0, react_1.useEffect)(function () {
        loadCapabilities();
    }, []);
    var loadCapabilities = function () { return __awaiter(_this, void 0, void 0, function () {
        var caps, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsCapabilitiesLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, index_1.getCapabilities)()];
                case 2:
                    caps = _a.sent();
                    setCapabilities(caps);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    // Fallback to synchronous constants
                    setCapabilities({
                        hasLiDAR: index_1.hasLiDAR,
                        supportsPhotogrammetry: index_1.supportsPhotogrammetry,
                        supportedMethods: __spreadArray(__spreadArray(__spreadArray([], (index_1.hasLiDAR ? ['lidar'] : []), true), (index_1.supportsPhotogrammetry ? ['photogrammetry'] : []), true), [
                            'template',
                        ], false),
                        deviceModel: 'unknown',
                        iosVersion: 'unknown',
                    });
                    return [3 /*break*/, 5];
                case 4:
                    setIsCapabilitiesLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var loadScanHistory = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var history_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, index_1.getScanHistory)()];
                case 1:
                    history_1 = _a.sent();
                    setScanHistory(history_1);
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    console.warn('Failed to load scan history:', err_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    var startScan = (0, react_1.useCallback)(function (method) {
        var _a;
        if (method === 'template') {
            setError('Template method does not require scanning');
            return;
        }
        // Validate method is supported
        if (method === 'lidar' && !index_1.hasLiDAR) {
            setError('LiDAR is not available on this device');
            return;
        }
        if (method === 'photogrammetry' && !index_1.supportsPhotogrammetry) {
            setError('Photogrammetry is not available on this device');
            return;
        }
        // Reset state
        setError(null);
        setScanResult(null);
        setScanProgress({
            state: 'initializing',
            coverage: 0,
            guidanceMessage: 'Preparing scanner...',
        });
        setIsScanning(true);
        // Start scan via native view ref
        (_a = scannerRef.current) === null || _a === void 0 ? void 0 : _a.startScan();
    }, []);
    var stopScan = (0, react_1.useCallback)(function () {
        var _a;
        (_a = scannerRef.current) === null || _a === void 0 ? void 0 : _a.stopScan();
        // Note: isScanning will be set to false when onScanComplete fires
    }, []);
    var capturePhoto = (0, react_1.useCallback)(function () {
        var _a;
        (_a = scannerRef.current) === null || _a === void 0 ? void 0 : _a.capturePhoto();
    }, []);
    var deleteExistingScan = (0, react_1.useCallback)(function (fileUri) { return __awaiter(_this, void 0, void 0, function () {
        var success, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, index_1.deleteScan)(fileUri)];
                case 1:
                    success = _a.sent();
                    if (success) {
                        setScanHistory(function (prev) { return prev.filter(function (s) { return s.meshFileUri !== fileUri; }); });
                    }
                    return [2 /*return*/, success];
                case 2:
                    err_3 = _a.sent();
                    console.warn('Failed to delete scan:', err_3);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    var checkMeshExists = (0, react_1.useCallback)(function (fileUri) { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, index_1.meshExists)(fileUri)];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    var getBestScanMethod = (0, react_1.useCallback)(function () {
        if (index_1.hasLiDAR) {
            return 'lidar';
        }
        if (index_1.supportsPhotogrammetry) {
            return 'photogrammetry';
        }
        return 'template';
    }, []);
    // Event handlers that should be passed to BodyScanner3DView
    var handleScanProgress = (0, react_1.useCallback)(function (event) {
        var progress = event.nativeEvent.progress;
        setScanProgress(progress);
        // Update photogrammetry-specific progress if available
        if ('photosCaptured' in progress) {
            setPhotogrammetryProgress(progress);
        }
    }, []);
    var handleScanComplete = (0, react_1.useCallback)(function (event) {
        var result = event.nativeEvent.result;
        setScanResult(result);
        setIsScanning(false);
        setScanProgress(function (prev) { return prev ? __assign(__assign({}, prev), { state: 'complete' }) : null; });
        if (result.success) {
            // Add to history
            setScanHistory(function (prev) { return __spreadArray([result], prev, true); });
        }
        else {
            setError(result.error || 'Scan failed');
        }
    }, []);
    var handleScanError = (0, react_1.useCallback)(function (event) {
        setError(event.nativeEvent.error);
        setIsScanning(false);
        setScanProgress(function (prev) { return prev ? __assign(__assign({}, prev), { state: 'error' }) : null; });
    }, []);
    return {
        // Capabilities
        capabilities: capabilities,
        isCapabilitiesLoading: isCapabilitiesLoading,
        // Current scan state
        scanProgress: scanProgress,
        photogrammetryProgress: photogrammetryProgress,
        isScanning: isScanning,
        scanResult: scanResult,
        error: error,
        // Scan control
        startScan: startScan,
        stopScan: stopScan,
        capturePhoto: capturePhoto,
        // History
        scanHistory: scanHistory,
        loadScanHistory: loadScanHistory,
        deleteExistingScan: deleteExistingScan,
        // Utilities
        checkMeshExists: checkMeshExists,
        getBestScanMethod: getBestScanMethod,
        scannerRef: scannerRef,
    };
}
