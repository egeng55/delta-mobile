import UIKit
import ARKit
import RealityKit

/// Delegate protocol for scan events
@available(iOS 14.0, *)
public protocol ARBodyScanViewDelegate: AnyObject {
    func bodyScanView(_ view: ARBodyScanView, didUpdateProgress progress: ScanProgressData)
    func bodyScanView(_ view: ARBodyScanView, didUpdateMesh vertexCount: Int, coverage: Float)
    func bodyScanView(_ view: ARBodyScanView, didCompleteScan result: ScanResultData)
    func bodyScanView(_ view: ARBodyScanView, didFailWithError error: Error)
}

/// Progress data structure
public struct ScanProgressData {
    public let state: String
    public let coverage: Float
    public let guidanceMessage: String
    public let meshVertexCount: Int
}

/// Result data structure
public struct ScanResultData {
    public let success: Bool
    public let meshFileUri: String?
    public let thumbnailUri: String?
    public let scanMethod: String
    public let scanDate: String
    public let scanDuration: Double
    public let meshVertexCount: Int
    public let error: String?
}

/// ARKit-based LiDAR body scanning view using RealityKit
@available(iOS 14.0, *)
public class ARBodyScanView: UIView {

    // MARK: - Properties

    public weak var delegate: ARBodyScanViewDelegate?

    private var arView: ARView!
    private var debugLabel: UILabel!
    private var updateTimer: Timer?

    // Scanning state
    private var isScanning = false
    private var scanStartTime: Date?
    private var totalVertexCount: Int = 0
    private var meshAnchorCount: Int = 0

    // Configuration
    public var showMeshPreview: Bool = true
    public var showGuides: Bool = true
    public var targetCoverage: Float = 80.0

    // MARK: - Initialization

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        backgroundColor = .black

        // Create ARView - let RealityKit auto-configure
        arView = ARView(frame: bounds)
        arView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(arView)

        // Debug label
        debugLabel = UILabel()
        debugLabel.numberOfLines = 0
        debugLabel.font = UIFont.monospacedSystemFont(ofSize: 10, weight: .medium)
        debugLabel.textColor = .white
        debugLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        debugLabel.text = "Initializing..."
        addSubview(debugLabel)

        updateDebug("View created - Device: \(DeviceCapabilities.deviceModel) iOS \(DeviceCapabilities.iosVersion)")
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        arView.frame = bounds
        debugLabel.frame = CGRect(x: 8, y: 44, width: bounds.width - 16, height: 180)
    }

    private func updateDebug(_ msg: String) {
        DispatchQueue.main.async {
            let hasLiDAR = DeviceCapabilities.hasLiDAR
            let supportsMesh = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)

            self.debugLabel.text = """
            [RealityKit Mode]
            LiDAR: \(hasLiDAR) | MeshSupport: \(supportsMesh)
            Scanning: \(self.isScanning)
            MeshAnchors: \(self.meshAnchorCount)
            Vertices: \(self.totalVertexCount)
            ---
            \(msg)
            """
        }
    }

    // MARK: - Public Methods

    public func startScan() {
        let device = DeviceCapabilities.deviceModel
        let ios = DeviceCapabilities.iosVersion
        updateDebug("Starting...\nDevice: \(device)\niOS: \(ios)")

        guard DeviceCapabilities.hasLiDAR else {
            updateDebug("ERROR: No LiDAR sensor\nDevice: \(device)")
            delegate?.bodyScanView(self, didFailWithError: ScanError.lidarNotAvailable)
            return
        }

        // Try RealityKit's scene understanding API first
        if #available(iOS 13.4, *) {
            // Enable scene understanding through RealityKit
            arView.environment.sceneUnderstanding.options = [.occlusion, .receivesLighting, .physics]
        }

        // Create ARKit configuration for mesh
        let config = ARWorldTrackingConfiguration()
        config.sceneReconstruction = .mesh
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic

        // Run session
        arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])

        // Enable ALL debug visualization
        arView.debugOptions = [.showSceneUnderstanding, .showWorldOrigin, .showFeaturePoints, .showAnchorOrigins]

        isScanning = true
        scanStartTime = Date()
        totalVertexCount = 0
        meshAnchorCount = 0

        // Start polling for mesh data
        updateTimer?.invalidate()
        updateTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.pollMeshData()
        }

        delegate?.bodyScanView(self, didUpdateProgress: ScanProgressData(
            state: "scanning",
            coverage: 0,
            guidanceMessage: "Point at walls/floor 1-3m away",
            meshVertexCount: 0
        ))

        updateDebug("Session running\nDevice: \(device)\nCheck for mesh visualization...")
    }

    private func pollMeshData() {
        guard isScanning, let frame = arView.session.currentFrame else { return }

        // Get all anchors from frame
        let allAnchors = frame.anchors
        let meshAnchors = allAnchors.compactMap { $0 as? ARMeshAnchor }
        let planeAnchors = allAnchors.compactMap { $0 as? ARPlaneAnchor }

        // Identify anchor types
        var anchorTypes: [String] = []
        for anchor in allAnchors {
            let typeName = String(describing: type(of: anchor))
                .replacingOccurrences(of: "AR", with: "")
                .replacingOccurrences(of: "Anchor", with: "")
            anchorTypes.append(typeName)
        }

        // Calculate total vertices
        var vertices = 0
        for mesh in meshAnchors {
            vertices += mesh.geometry.vertices.count
        }

        meshAnchorCount = meshAnchors.count
        totalVertexCount = vertices

        // Check configuration
        let config = arView.session.configuration as? ARWorldTrackingConfiguration
        let meshMode = config?.sceneReconstruction.rawValue ?? 999

        // Build status
        var status = "iOS: \(DeviceCapabilities.iosVersion)\n"
        status += "Config meshMode: \(meshMode)\n"
        status += "Anchors: \(anchorTypes.joined(separator: ", "))\n"
        status += "Mesh: \(meshAnchors.count), Plane: \(planeAnchors.count)\n"

        // Check depth
        if let depth = frame.sceneDepth {
            let w = CVPixelBufferGetWidth(depth.depthMap)
            let h = CVPixelBufferGetHeight(depth.depthMap)
            status += "Depth: \(w)x\(h)\n"
        } else if let depth = frame.estimatedDepthData {
            let w = CVPixelBufferGetWidth(depth)
            let h = CVPixelBufferGetHeight(depth)
            status += "EstDepth: \(w)x\(h)\n"
        } else {
            status += "Depth: NONE\n"
        }

        // Check tracking state
        switch frame.camera.trackingState {
        case .normal:
            status += "Track: OK"
        case .limited(let reason):
            status += "Track: LTD(\(reason))"
        case .notAvailable:
            status += "Track: NO"
        }

        updateDebug(status)

        // Update progress
        let coverage = calculateCoverage()
        delegate?.bodyScanView(self, didUpdateProgress: ScanProgressData(
            state: "scanning",
            coverage: coverage,
            guidanceMessage: meshAnchors.isEmpty ? "Move camera slowly over surfaces" : "Scanning... \(vertices) vertices",
            meshVertexCount: vertices
        ))

        if coverage >= targetCoverage {
            stopScan { _ in }
        }
    }

    public func stopScan(completion: @escaping (ScanResultData) -> Void) {
        updateTimer?.invalidate()
        updateTimer = nil

        guard isScanning else {
            completion(ScanResultData(
                success: false, meshFileUri: nil, thumbnailUri: nil,
                scanMethod: "lidar", scanDate: ISO8601DateFormatter().string(from: Date()),
                scanDuration: 0, meshVertexCount: 0, error: "No scan in progress"
            ))
            return
        }

        isScanning = false
        let duration = Date().timeIntervalSince(scanStartTime ?? Date())

        // Get mesh anchors from current frame
        guard let frame = arView.session.currentFrame else {
            completion(ScanResultData(
                success: false, meshFileUri: nil, thumbnailUri: nil,
                scanMethod: "lidar", scanDate: ISO8601DateFormatter().string(from: Date()),
                scanDuration: duration, meshVertexCount: 0, error: "No frame available"
            ))
            return
        }

        let meshAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }

        guard !meshAnchors.isEmpty else {
            completion(ScanResultData(
                success: false, meshFileUri: nil, thumbnailUri: nil,
                scanMethod: "lidar", scanDate: ISO8601DateFormatter().string(from: Date()),
                scanDuration: duration, meshVertexCount: 0,
                error: "No mesh captured. Ensure LiDAR is working and move camera over surfaces."
            ))
            return
        }

        delegate?.bodyScanView(self, didUpdateProgress: ScanProgressData(
            state: "processing", coverage: calculateCoverage(),
            guidanceMessage: "Exporting mesh...", meshVertexCount: totalVertexCount
        ))

        MeshExporter.exportToUSDZ(meshAnchors: meshAnchors) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let url):
                let scanResult = ScanResultData(
                    success: true, meshFileUri: url.absoluteString, thumbnailUri: nil,
                    scanMethod: "lidar", scanDate: ISO8601DateFormatter().string(from: Date()),
                    scanDuration: duration, meshVertexCount: self.totalVertexCount, error: nil
                )
                DispatchQueue.main.async {
                    self.delegate?.bodyScanView(self, didCompleteScan: scanResult)
                    completion(scanResult)
                }
            case .failure(let error):
                completion(ScanResultData(
                    success: false, meshFileUri: nil, thumbnailUri: nil,
                    scanMethod: "lidar", scanDate: ISO8601DateFormatter().string(from: Date()),
                    scanDuration: duration, meshVertexCount: 0, error: error.localizedDescription
                ))
            }
        }
    }

    public func cancelScan() {
        updateTimer?.invalidate()
        updateTimer = nil
        isScanning = false
        arView.session.pause()
    }

    private func calculateCoverage() -> Float {
        let target: Float = 30000
        return min(Float(totalVertexCount) / target * 100, 100)
    }

    deinit {
        updateTimer?.invalidate()
    }
}

// MARK: - Errors

enum ScanError: Error, LocalizedError {
    case lidarNotAvailable
    case sessionFailed
    case noBodyDetected
    case exportFailed

    var errorDescription: String? {
        switch self {
        case .lidarNotAvailable: return "LiDAR not available"
        case .sessionFailed: return "AR session failed"
        case .noBodyDetected: return "No body detected"
        case .exportFailed: return "Export failed"
        }
    }
}
