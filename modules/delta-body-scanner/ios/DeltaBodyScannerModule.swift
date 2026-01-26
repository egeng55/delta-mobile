import ExpoModulesCore
import ARKit

public class DeltaBodyScannerModule: Module {

    // Active scan view reference
    private var activeScanView: Any? = nil
    private var activePhotogrammetry: Any? = nil

    public func definition() -> ModuleDefinition {
        Name("DeltaBodyScanner")

        // MARK: - Constants

        Constants {
            return [
                "hasLiDAR": DeviceCapabilities.hasLiDAR,
                "supportsPhotogrammetry": DeviceCapabilities.supportsPhotogrammetry,
                "supportsARKit": DeviceCapabilities.supportsARKit
            ]
        }

        // MARK: - Events

        Events(
            "onScanProgress",
            "onScanComplete",
            "onScanError",
            "onMeshUpdate",
            "onPhotoCapture",
            "onPhotogrammetryProgress"
        )

        // MARK: - Functions

        // Get full device capabilities
        AsyncFunction("getCapabilities") { () -> [String: Any] in
            return DeviceCapabilities.capabilities
        }

        // Start LiDAR scan
        AsyncFunction("startLiDARScan") { () -> Bool in
            guard DeviceCapabilities.hasLiDAR else {
                throw BodyScannerError.lidarNotAvailable
            }

            if #available(iOS 14.0, *) {
                // LiDAR scanning is handled by the native view component
                // This function just validates capabilities
                return true
            } else {
                throw BodyScannerError.iosVersionNotSupported
            }
        }

        // Start photogrammetry scan
        AsyncFunction("startPhotogrammetryScan") { () -> Bool in
            guard DeviceCapabilities.supportsPhotogrammetry else {
                throw BodyScannerError.photogrammetryNotSupported
            }

            if #available(iOS 17.0, *) {
                return true
            } else {
                throw BodyScannerError.iosVersionNotSupported
            }
        }

        // Export mesh to specified format
        AsyncFunction("exportMesh") { (format: String) -> [String: Any] in
            guard format == "usdz" || format == "glb" || format == "obj" else {
                throw BodyScannerError.invalidFormat
            }

            // Export is handled internally during scan completion
            // This returns the last exported mesh info
            return [
                "format": format,
                "status": "export_handled_by_scan_view"
            ]
        }

        // Delete a scan file
        AsyncFunction("deleteScan") { (fileUri: String) -> Bool in
            guard let url = URL(string: fileUri) else {
                return false
            }
            return MeshExporter.deleteScan(at: url)
        }

        // Get list of saved scans
        AsyncFunction("getScanHistory") { () -> [[String: Any]] in
            let scansDir = MeshExporter.scansDirectory
            var scans: [[String: Any]] = []

            if let files = try? FileManager.default.contentsOfDirectory(at: scansDir, includingPropertiesForKeys: [.creationDateKey], options: [.skipsHiddenFiles]) {
                for file in files where file.pathExtension == "usdz" {
                    let attributes = try? FileManager.default.attributesOfItem(atPath: file.path)
                    let creationDate = attributes?[.creationDate] as? Date ?? Date()

                    scans.append([
                        "meshFileUri": file.absoluteString,
                        "meshFormat": "usdz",
                        "scanDate": ISO8601DateFormatter().string(from: creationDate),
                        "scanMethod": "lidar" // Could be stored in metadata
                    ])
                }
            }

            return scans.sorted { ($0["scanDate"] as? String ?? "") > ($1["scanDate"] as? String ?? "") }
        }

        // Check if a mesh file exists
        AsyncFunction("meshExists") { (fileUri: String) -> Bool in
            guard let url = URL(string: fileUri) else {
                return false
            }
            return FileManager.default.fileExists(atPath: url.path)
        }

        // Get mesh file size
        AsyncFunction("getMeshFileSize") { (fileUri: String) -> Int in
            guard let url = URL(string: fileUri),
                  let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
                  let size = attributes[.size] as? Int else {
                return 0
            }
            return size
        }

        // MARK: - Views

        // Body Scanner 3D View (LiDAR)
        View(BodyScanner3DView.self) {
            Events(
                "onScanProgress",
                "onScanComplete",
                "onScanError",
                "onMeshUpdate"
            )

            Prop("scanMethod") { (view: BodyScanner3DView, method: String) in
                view.scanMethod = method
            }

            Prop("autoStart") { (view: BodyScanner3DView, autoStart: Bool) in
                view.autoStart = autoStart
            }

            Prop("showGuides") { (view: BodyScanner3DView, show: Bool) in
                view.showGuides = show
            }

            Prop("showMeshPreview") { (view: BodyScanner3DView, show: Bool) in
                view.showMeshPreview = show
            }
        }

        // Model 3D Viewer
        View(Model3DViewWrapper.self) {
            Events(
                "onModelLoaded",
                "onModelError"
            )

            Prop("modelUri") { (view: Model3DViewWrapper, uri: String) in
                view.modelUri = uri
            }

            Prop("autoRotate") { (view: Model3DViewWrapper, rotate: Bool) in
                view.autoRotate = rotate
            }

            Prop("allowUserInteraction") { (view: Model3DViewWrapper, allow: Bool) in
                view.allowUserInteraction = allow
            }

            Prop("backgroundColor") { (view: Model3DViewWrapper, color: String) in
                view.backgroundColorHex = color
            }

            Prop("lightingIntensity") { (view: Model3DViewWrapper, intensity: Double) in
                view.lightingIntensity = CGFloat(intensity)
            }
        }
    }
}

// MARK: - Errors

enum BodyScannerError: Error, LocalizedError {
    case lidarNotAvailable
    case photogrammetryNotSupported
    case iosVersionNotSupported
    case invalidFormat
    case scanFailed(String)
    case exportFailed(String)

    var errorDescription: String? {
        switch self {
        case .lidarNotAvailable:
            return "LiDAR sensor is not available on this device"
        case .photogrammetryNotSupported:
            return "Photogrammetry is not supported on this device (requires iOS 17+)"
        case .iosVersionNotSupported:
            return "This feature requires a newer iOS version"
        case .invalidFormat:
            return "Invalid export format. Supported formats: usdz, glb, obj"
        case .scanFailed(let reason):
            return "Scan failed: \(reason)"
        case .exportFailed(let reason):
            return "Export failed: \(reason)"
        }
    }
}

// MARK: - Body Scanner 3D View (Expo View Wrapper)

public class BodyScanner3DView: ExpoView {

    var scanMethod: String = "lidar" {
        didSet {
            if scanMethod != oldValue {
                setupScannerIfNeeded()
            }
        }
    }
    var autoStart: Bool = false
    var showGuides: Bool = true
    var showMeshPreview: Bool = true

    private var arScanView: Any? = nil
    private var photogrammetryCapture: Any? = nil
    private var isSetup = false

    let onScanProgress = EventDispatcher()
    let onScanComplete = EventDispatcher()
    let onScanError = EventDispatcher()
    let onMeshUpdate = EventDispatcher()

    public override func layoutSubviews() {
        super.layoutSubviews()

        // Setup scanner only once
        if !isSetup && !bounds.isEmpty {
            setupScannerIfNeeded()
        }

        // Update child view frame
        if #available(iOS 14.0, *), let scanView = arScanView as? ARBodyScanView {
            scanView.frame = bounds
        }
    }

    private func setupScannerIfNeeded() {
        guard !isSetup else { return }
        isSetup = true

        // Initialize appropriate scanner based on method
        if scanMethod == "lidar" {
            setupLiDARScanner()
        } else if scanMethod == "photogrammetry" {
            setupPhotogrammetryScanner()
        }
    }

    private func setupLiDARScanner() {
        guard DeviceCapabilities.hasLiDAR else {
            onScanError([
                "error": "LiDAR not available",
                "code": "LIDAR_NOT_AVAILABLE"
            ])
            return
        }

        if #available(iOS 14.0, *) {
            // Remove existing view if any
            if let existingView = arScanView as? ARBodyScanView {
                existingView.removeFromSuperview()
            }

            let scanView = ARBodyScanView(frame: bounds)
            scanView.delegate = self
            scanView.showGuides = showGuides
            scanView.showMeshPreview = showMeshPreview
            scanView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(scanView)
            arScanView = scanView

            // Start scan immediately - the camera should be visible
            scanView.startScan()
        }
    }

    private func setupPhotogrammetryScanner() {
        guard DeviceCapabilities.supportsPhotogrammetry else {
            onScanError([
                "error": "Photogrammetry not supported",
                "code": "PHOTOGRAMMETRY_NOT_SUPPORTED"
            ])
            return
        }

        if #available(iOS 17.0, *) {
            let capture = PhotogrammetryCapture()
            capture.delegate = self
            photogrammetryCapture = capture

            capture.setupCamera(in: self) { [weak self] success in
                if success && self?.autoStart == true {
                    capture.startCapture()
                } else if !success {
                    self?.onScanError([
                        "error": "Failed to setup camera",
                        "code": "CAMERA_SETUP_FAILED"
                    ])
                }
            }
        }
    }

    // Public methods that can be called from React Native via refs
    public func startScan() {
        if #available(iOS 14.0, *), let scanView = arScanView as? ARBodyScanView {
            scanView.startScan()
        } else if #available(iOS 17.0, *), let capture = photogrammetryCapture as? PhotogrammetryCapture {
            capture.startCapture()
        }
    }

    public func stopScan() {
        if #available(iOS 14.0, *), let scanView = arScanView as? ARBodyScanView {
            scanView.stopScan { _ in }
        } else if #available(iOS 17.0, *), let capture = photogrammetryCapture as? PhotogrammetryCapture {
            capture.stopCapture()
            capture.processPhotos { _ in }
        }
    }

    public func capturePhoto() {
        if #available(iOS 17.0, *), let capture = photogrammetryCapture as? PhotogrammetryCapture {
            capture.capturePhoto()
        }
    }
}

// MARK: - ARBodyScanViewDelegate

@available(iOS 14.0, *)
extension BodyScanner3DView: ARBodyScanViewDelegate {
    public func bodyScanView(_ view: ARBodyScanView, didUpdateProgress progress: ScanProgressData) {
        onScanProgress([
            "progress": [
                "state": progress.state,
                "coverage": progress.coverage * 100,
                "guidanceMessage": progress.guidanceMessage,
                "meshVertexCount": progress.meshVertexCount
            ]
        ])
    }

    public func bodyScanView(_ view: ARBodyScanView, didUpdateMesh vertexCount: Int, coverage: Float) {
        onMeshUpdate([
            "vertexCount": vertexCount,
            "coverage": coverage * 100
        ])
    }

    public func bodyScanView(_ view: ARBodyScanView, didCompleteScan result: ScanResultData) {
        onScanComplete([
            "result": [
                "success": result.success,
                "meshFileUri": result.meshFileUri ?? "",
                "meshFormat": "usdz",
                "thumbnailUri": result.thumbnailUri ?? "",
                "scanMethod": result.scanMethod,
                "scanDate": result.scanDate,
                "scanDuration": result.scanDuration,
                "meshVertexCount": result.meshVertexCount,
                "error": result.error ?? ""
            ]
        ])
    }

    public func bodyScanView(_ view: ARBodyScanView, didFailWithError error: Error) {
        onScanError([
            "error": error.localizedDescription,
            "code": "SCAN_ERROR"
        ])
    }
}

// MARK: - PhotogrammetryCaptureDelegate

@available(iOS 17.0, *)
extension BodyScanner3DView: PhotogrammetryCaptureDelegate {
    public func photogrammetryCapture(_ capture: PhotogrammetryCapture, didUpdateProgress progress: PhotogrammetryProgressData) {
        onScanProgress([
            "progress": [
                "state": progress.state,
                "coverage": Float(progress.photosCaptured) / Float(progress.photosRequired) * 100,
                "guidanceMessage": progress.guidanceMessage,
                "photosCaptured": progress.photosCaptured,
                "photosRequired": progress.photosRequired,
                "processingProgress": progress.processingProgress,
                "guidanceAngle": progress.guidanceAngle ?? 0
            ]
        ])
    }

    public func photogrammetryCapture(_ capture: PhotogrammetryCapture, didCapturePhoto index: Int, total: Int) {
        onMeshUpdate([
            "photoIndex": index,
            "totalPhotos": total
        ])
    }

    public func photogrammetryCapture(_ capture: PhotogrammetryCapture, didComplete result: ScanResultData) {
        onScanComplete([
            "result": [
                "success": result.success,
                "meshFileUri": result.meshFileUri ?? "",
                "meshFormat": "usdz",
                "thumbnailUri": result.thumbnailUri ?? "",
                "scanMethod": result.scanMethod,
                "scanDate": result.scanDate,
                "scanDuration": result.scanDuration,
                "meshVertexCount": result.meshVertexCount,
                "error": result.error ?? ""
            ]
        ])
    }

    public func photogrammetryCapture(_ capture: PhotogrammetryCapture, didFailWithError error: Error) {
        onScanError([
            "error": error.localizedDescription,
            "code": "PHOTOGRAMMETRY_ERROR"
        ])
    }
}
