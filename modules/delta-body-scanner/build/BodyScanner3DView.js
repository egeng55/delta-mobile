"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BodyScanner3DView = void 0;
var react_1 = require("react");
var expo_modules_core_1 = require("expo-modules-core");
// Get the native view
var NativeBodyScanner3DView = (0, expo_modules_core_1.requireNativeViewManager)('DeltaBodyScanner');
exports.BodyScanner3DView = (0, react_1.forwardRef)(function (_a, ref) {
    var _b = _a.scanMethod, scanMethod = _b === void 0 ? 'lidar' : _b, _c = _a.autoStart, autoStart = _c === void 0 ? false : _c, _d = _a.showGuides, showGuides = _d === void 0 ? true : _d, _e = _a.showMeshPreview, showMeshPreview = _e === void 0 ? true : _e, onScanProgress = _a.onScanProgress, onScanComplete = _a.onScanComplete, onScanError = _a.onScanError, onMeshUpdate = _a.onMeshUpdate, style = _a.style, props = __rest(_a, ["scanMethod", "autoStart", "showGuides", "showMeshPreview", "onScanProgress", "onScanComplete", "onScanError", "onMeshUpdate", "style"]);
    var nativeRef = (0, react_1.useRef)(null);
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        startScan: function () {
            var _a, _b;
            (_b = (_a = nativeRef.current) === null || _a === void 0 ? void 0 : _a.startScan) === null || _b === void 0 ? void 0 : _b.call(_a);
        },
        stopScan: function () {
            var _a, _b;
            (_b = (_a = nativeRef.current) === null || _a === void 0 ? void 0 : _a.stopScan) === null || _b === void 0 ? void 0 : _b.call(_a);
        },
        capturePhoto: function () {
            var _a, _b;
            (_b = (_a = nativeRef.current) === null || _a === void 0 ? void 0 : _a.capturePhoto) === null || _b === void 0 ? void 0 : _b.call(_a);
        },
    }); });
    return (<NativeBodyScanner3DView ref={nativeRef} scanMethod={scanMethod} autoStart={autoStart} showGuides={showGuides} showMeshPreview={showMeshPreview} onScanProgress={function (event) {
            onScanProgress === null || onScanProgress === void 0 ? void 0 : onScanProgress(event);
        }} onScanComplete={function (event) {
            onScanComplete === null || onScanComplete === void 0 ? void 0 : onScanComplete(event);
        }} onScanError={function (event) {
            onScanError === null || onScanError === void 0 ? void 0 : onScanError(event);
        }} onMeshUpdate={function (event) {
            onMeshUpdate === null || onMeshUpdate === void 0 ? void 0 : onMeshUpdate(event);
        }} style={[{ flex: 1 }, style]} {...props}/>);
});
exports.BodyScanner3DView.displayName = 'BodyScanner3DView';
