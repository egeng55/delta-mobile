import Foundation
import AVFoundation
import UIKit
import RealityKit

/// Delegate protocol for photogrammetry events
@available(iOS 17.0, *)
public protocol PhotogrammetryCaptureDelegate: AnyObject {
    func photogrammetryCapture(_ capture: PhotogrammetryCapture, didUpdateProgress progress: PhotogrammetryProgressData)
    func photogrammetryCapture(_ capture: PhotogrammetryCapture, didCapturePhoto index: Int, total: Int)
    func photogrammetryCapture(_ capture: PhotogrammetryCapture, didComplete result: ScanResultData)
    func photogrammetryCapture(_ capture: PhotogrammetryCapture, didFailWithError error: Error)
}

/// Progress data for photogrammetry
public struct PhotogrammetryProgressData {
    public let state: String
    public let photosCaptured: Int
    public let photosRequired: Int
    public let processingProgress: Float
    public let guidanceAngle: Float?
    public let guidanceMessage: String
}

/// Photogrammetry-based 3D capture for non-LiDAR devices (iOS 17+)
@available(iOS 17.0, *)
public class PhotogrammetryCapture: NSObject {

    // MARK: - Properties

    public weak var delegate: PhotogrammetryCaptureDelegate?

    private var captureSession: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    // Capture state
    private var isCapturing = false
    private var capturedPhotos: [Data] = []
    private var captureStartTime: Date?

    // Configuration
    public var requiredPhotoCount: Int = 24 // 24 photos at 15° intervals
    public var captureInterval: TimeInterval = 1.5 // seconds between captures

    // Guidance
    private var currentAngle: Float = 0
    private var angleIncrement: Float { 360.0 / Float(requiredPhotoCount) }

    // Timer for auto-capture
    private var captureTimer: Timer?

    // MARK: - Initialization

    public override init() {
        super.init()
    }

    // MARK: - Public Methods

    /// Setup camera for photogrammetry capture
    public func setupCamera(in view: UIView, completion: @escaping (Bool) -> Void) {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            DispatchQueue.main.async {
                guard granted else {
                    completion(false)
                    return
                }

                self?.configureCaptureSession(in: view)
                completion(self?.captureSession != nil)
            }
        }
    }

    private func configureCaptureSession(in view: UIView) {
        let session = AVCaptureSession()
        session.sessionPreset = .photo

        // Setup camera input
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera) else {
            return
        }

        if session.canAddInput(input) {
            session.addInput(input)
        }

        // Setup photo output
        let output = AVCapturePhotoOutput()
        output.isHighResolutionCaptureEnabled = true
        output.maxPhotoQualityPrioritization = .quality

        if session.canAddOutput(output) {
            session.addOutput(output)
        }

        photoOutput = output

        // Setup preview layer
        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = view.bounds
        view.layer.insertSublayer(preview, at: 0)

        previewLayer = preview
        captureSession = session

        // Start session on background thread
        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
        }
    }

    /// Start guided photo capture
    public func startCapture() {
        guard !isCapturing, captureSession?.isRunning == true else { return }

        isCapturing = true
        capturedPhotos = []
        captureStartTime = Date()
        currentAngle = 0

        // Send initial progress
        delegate?.photogrammetryCapture(self, didUpdateProgress: PhotogrammetryProgressData(
            state: "capturing",
            photosCaptured: 0,
            photosRequired: requiredPhotoCount,
            processingProgress: 0,
            guidanceAngle: currentAngle,
            guidanceMessage: "Stand in front of the camera. Tap to capture."
        ))
    }

    /// Capture a single photo
    public func capturePhoto() {
        guard isCapturing, let output = photoOutput else { return }

        let settings = AVCapturePhotoSettings()
        settings.isHighResolutionPhotoEnabled = true

        output.capturePhoto(with: settings, delegate: self)
    }

    /// Start auto-capture mode
    public func startAutoCapture() {
        startCapture()

        captureTimer = Timer.scheduledTimer(withTimeInterval: captureInterval, repeats: true) { [weak self] _ in
            self?.capturePhoto()
        }
    }

    /// Stop capture
    public func stopCapture() {
        captureTimer?.invalidate()
        captureTimer = nil
        isCapturing = false
    }

    /// Process captured photos into 3D model
    public func processPhotos(completion: @escaping (ScanResultData) -> Void) {
        guard !capturedPhotos.isEmpty else {
            completion(ScanResultData(
                success: false,
                meshFileUri: nil,
                thumbnailUri: nil,
                scanMethod: "photogrammetry",
                scanDate: ISO8601DateFormatter().string(from: Date()),
                scanDuration: 0,
                meshVertexCount: 0,
                error: "No photos captured"
            ))
            return
        }

        let scanDuration = Date().timeIntervalSince(captureStartTime ?? Date())

        delegate?.photogrammetryCapture(self, didUpdateProgress: PhotogrammetryProgressData(
            state: "processing",
            photosCaptured: capturedPhotos.count,
            photosRequired: requiredPhotoCount,
            processingProgress: 0,
            guidanceAngle: nil,
            guidanceMessage: "Processing photos..."
        ))

        // Process with Object Capture API
        processWithObjectCapture(photos: capturedPhotos, duration: scanDuration, completion: completion)
    }

    @available(iOS 17.0, *)
    private func processWithObjectCapture(photos: [Data], duration: Double, completion: @escaping (ScanResultData) -> Void) {
        // Save photos to temporary directory for Object Capture
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("photogrammetry_\(UUID().uuidString)")

        do {
            try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

            // Save each photo
            for (index, photoData) in photos.enumerated() {
                let photoURL = tempDir.appendingPathComponent("photo_\(String(format: "%03d", index)).heic")
                try photoData.write(to: photoURL)
            }

            // Create output URL
            let outputURL = MeshExporter.scansDirectory.appendingPathComponent(MeshExporter.generateScanFilename(format: "usdz"))

            // Use PhotogrammetrySession to process
            Task {
                do {
                    let session = try PhotogrammetrySession(input: tempDir)

                    // Process with reduced quality for mobile-optimized output
                    try session.process(requests: [PhotogrammetrySession.Request.modelFile(url: outputURL, detail: .reduced)])

                    // Monitor progress
                    for try await output in session.outputs {
                        switch output {
                        case .processingComplete:
                            // Clean up temp files
                            try? FileManager.default.removeItem(at: tempDir)

                            let result = ScanResultData(
                                success: true,
                                meshFileUri: outputURL.absoluteString,
                                thumbnailUri: nil,
                                scanMethod: "photogrammetry",
                                scanDate: ISO8601DateFormatter().string(from: Date()),
                                scanDuration: duration,
                                meshVertexCount: 0, // Not easily available from photogrammetry
                                error: nil
                            )

                            await MainActor.run {
                                self.delegate?.photogrammetryCapture(self, didComplete: result)
                                completion(result)
                            }

                        case .requestProgress(let request, let fraction):
                            await MainActor.run {
                                self.delegate?.photogrammetryCapture(self, didUpdateProgress: PhotogrammetryProgressData(
                                    state: "processing",
                                    photosCaptured: photos.count,
                                    photosRequired: self.requiredPhotoCount,
                                    processingProgress: Float(fraction),
                                    guidanceAngle: nil,
                                    guidanceMessage: "Processing: \(Int(fraction * 100))%"
                                ))
                            }

                        case .requestError(_, let error):
                            await MainActor.run {
                                let result = ScanResultData(
                                    success: false,
                                    meshFileUri: nil,
                                    thumbnailUri: nil,
                                    scanMethod: "photogrammetry",
                                    scanDate: ISO8601DateFormatter().string(from: Date()),
                                    scanDuration: duration,
                                    meshVertexCount: 0,
                                    error: error.localizedDescription
                                )
                                completion(result)
                            }

                        default:
                            break
                        }
                    }
                } catch {
                    await MainActor.run {
                        let result = ScanResultData(
                            success: false,
                            meshFileUri: nil,
                            thumbnailUri: nil,
                            scanMethod: "photogrammetry",
                            scanDate: ISO8601DateFormatter().string(from: Date()),
                            scanDuration: duration,
                            meshVertexCount: 0,
                            error: error.localizedDescription
                        )
                        completion(result)
                    }
                }
            }
        } catch {
            completion(ScanResultData(
                success: false,
                meshFileUri: nil,
                thumbnailUri: nil,
                scanMethod: "photogrammetry",
                scanDate: ISO8601DateFormatter().string(from: Date()),
                scanDuration: duration,
                meshVertexCount: 0,
                error: error.localizedDescription
            ))
        }
    }

    /// Clean up resources
    public func cleanup() {
        stopCapture()
        captureSession?.stopRunning()
        previewLayer?.removeFromSuperlayer()
        captureSession = nil
        photoOutput = nil
        previewLayer = nil
    }

    // MARK: - Private Methods

    private func getGuidanceForAngle(_ angle: Float) -> String {
        let position = Int(angle / angleIncrement) + 1
        let total = requiredPhotoCount

        if position <= 6 {
            return "Front view (\(position)/\(total))"
        } else if position <= 12 {
            return "Side view (\(position)/\(total))"
        } else if position <= 18 {
            return "Back view (\(position)/\(total))"
        } else {
            return "Other side (\(position)/\(total))"
        }
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

@available(iOS 17.0, *)
extension PhotogrammetryCapture: AVCapturePhotoCaptureDelegate {

    public func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard isCapturing else { return }

        if let error = error {
            delegate?.photogrammetryCapture(self, didFailWithError: error)
            return
        }

        guard let photoData = photo.fileDataRepresentation() else { return }

        capturedPhotos.append(photoData)

        let photoIndex = capturedPhotos.count
        delegate?.photogrammetryCapture(self, didCapturePhoto: photoIndex, total: requiredPhotoCount)

        // Update guidance for next angle
        currentAngle += angleIncrement

        if photoIndex >= requiredPhotoCount {
            // All photos captured, start processing
            stopCapture()
            processPhotos { _ in }
        } else {
            // Update progress for next capture
            delegate?.photogrammetryCapture(self, didUpdateProgress: PhotogrammetryProgressData(
                state: "capturing",
                photosCaptured: photoIndex,
                photosRequired: requiredPhotoCount,
                processingProgress: 0,
                guidanceAngle: currentAngle,
                guidanceMessage: getGuidanceForAngle(currentAngle)
            ))
        }
    }
}
