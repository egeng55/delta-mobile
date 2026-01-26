import Foundation
import ARKit
import SceneKit
import ModelIO
import MetalKit

/// Exports AR mesh data to various 3D formats
public class MeshExporter {

    /// Shared Metal device for mesh processing
    private static let metalDevice: MTLDevice? = MTLCreateSystemDefaultDevice()

    /// Directory for storing scan files
    public static var scansDirectory: URL {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let scansPath = documentsPath.appendingPathComponent("delta-scans", isDirectory: true)

        // Create directory if it doesn't exist
        if !FileManager.default.fileExists(atPath: scansPath.path) {
            try? FileManager.default.createDirectory(at: scansPath, withIntermediateDirectories: true)
        }

        return scansPath
    }

    /// Generate a unique filename for a scan
    public static func generateScanFilename(format: String) -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd_HHmmss"
        let timestamp = dateFormatter.string(from: Date())
        return "body_scan_\(timestamp).\(format)"
    }

    /// Export ARMeshAnchor array to USDZ format
    @available(iOS 14.0, *)
    public static func exportToUSDZ(meshAnchors: [ARMeshAnchor], completion: @escaping (Result<URL, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                // Create a combined SCNNode from all mesh anchors
                let rootNode = SCNNode()

                for anchor in meshAnchors {
                    if let meshNode = createSCNNode(from: anchor) {
                        rootNode.addChildNode(meshNode)
                    }
                }

                // Create SCNScene with the mesh
                let scene = SCNScene()
                scene.rootNode.addChildNode(rootNode)

                // Export to USDZ
                let filename = generateScanFilename(format: "usdz")
                let fileURL = scansDirectory.appendingPathComponent(filename)

                // Use SCNScene's write method for USDZ export
                let success = scene.write(to: fileURL, options: nil, delegate: nil, progressHandler: nil)

                DispatchQueue.main.async {
                    if success {
                        completion(.success(fileURL))
                    } else {
                        completion(.failure(MeshExportError.exportFailed("Failed to write USDZ file")))
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }

    /// Export ARMeshAnchor array to OBJ format (intermediate for GLB conversion)
    @available(iOS 14.0, *)
    public static func exportToOBJ(meshAnchors: [ARMeshAnchor], completion: @escaping (Result<URL, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                var objContent = "# Delta Body Scan\n"
                objContent += "# Generated: \(Date())\n\n"

                var vertexOffset = 0

                for anchor in meshAnchors {
                    let geometry = anchor.geometry
                    let vertices = geometry.vertices
                    let faces = geometry.faces

                    // Transform vertices to world space
                    let transform = anchor.transform

                    // Write vertices
                    for i in 0..<vertices.count {
                        let vertex = vertices.vertex(at: i)
                        let worldVertex = simd_make_float4(vertex.x, vertex.y, vertex.z, 1.0)
                        let transformedVertex = transform * worldVertex
                        objContent += "v \(transformedVertex.x) \(transformedVertex.y) \(transformedVertex.z)\n"
                    }

                    // Write faces (convert from 0-indexed to 1-indexed)
                    for i in 0..<faces.count {
                        let face = faces.face(at: i)
                        let v1 = Int(face[0]) + 1 + vertexOffset
                        let v2 = Int(face[1]) + 1 + vertexOffset
                        let v3 = Int(face[2]) + 1 + vertexOffset
                        objContent += "f \(v1) \(v2) \(v3)\n"
                    }

                    vertexOffset += vertices.count
                }

                // Write to file
                let filename = generateScanFilename(format: "obj")
                let fileURL = scansDirectory.appendingPathComponent(filename)
                try objContent.write(to: fileURL, atomically: true, encoding: .utf8)

                DispatchQueue.main.async {
                    completion(.success(fileURL))
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }

    /// Create SCNNode from ARMeshAnchor
    @available(iOS 14.0, *)
    private static func createSCNNode(from anchor: ARMeshAnchor) -> SCNNode? {
        let geometry = anchor.geometry

        // Create vertex source
        let vertices = geometry.vertices
        var vertexData = Data()
        for i in 0..<vertices.count {
            var vertex = vertices.vertex(at: i)
            vertexData.append(Data(bytes: &vertex, count: MemoryLayout<SIMD3<Float>>.size))
        }

        let vertexSource = SCNGeometrySource(
            data: vertexData,
            semantic: .vertex,
            vectorCount: vertices.count,
            usesFloatComponents: true,
            componentsPerVector: 3,
            bytesPerComponent: MemoryLayout<Float>.size,
            dataOffset: 0,
            dataStride: MemoryLayout<SIMD3<Float>>.size
        )

        // Create normals source
        let normals = geometry.normals
        var normalData = Data()
        for i in 0..<normals.count {
            var normal = normals.normal(at: i)
            normalData.append(Data(bytes: &normal, count: MemoryLayout<SIMD3<Float>>.size))
        }

        let normalSource = SCNGeometrySource(
            data: normalData,
            semantic: .normal,
            vectorCount: normals.count,
            usesFloatComponents: true,
            componentsPerVector: 3,
            bytesPerComponent: MemoryLayout<Float>.size,
            dataOffset: 0,
            dataStride: MemoryLayout<SIMD3<Float>>.size
        )

        // Create face indices
        let faces = geometry.faces
        var indexData = Data()
        for i in 0..<faces.count {
            var face = faces.face(at: i)
            indexData.append(Data(bytes: &face, count: MemoryLayout<SIMD3<UInt32>>.size))
        }

        let element = SCNGeometryElement(
            data: indexData,
            primitiveType: .triangles,
            primitiveCount: faces.count,
            bytesPerIndex: MemoryLayout<UInt32>.size
        )

        // Create geometry
        let scnGeometry = SCNGeometry(sources: [vertexSource, normalSource], elements: [element])

        // Apply a basic material
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 0.85, green: 0.75, blue: 0.70, alpha: 1.0) // Skin-like tone
        material.lightingModel = .physicallyBased
        material.roughness.contents = 0.5
        material.metalness.contents = 0.0
        scnGeometry.materials = [material]

        // Create node and apply transform
        let node = SCNNode(geometry: scnGeometry)
        node.simdTransform = anchor.transform

        return node
    }

    /// Generate thumbnail image from mesh
    @available(iOS 14.0, *)
    public static func generateThumbnail(meshAnchors: [ARMeshAnchor], size: CGSize = CGSize(width: 256, height: 256), completion: @escaping (Result<URL, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            // Create scene
            let scene = SCNScene()
            let rootNode = SCNNode()

            for anchor in meshAnchors {
                if let meshNode = createSCNNode(from: anchor) {
                    rootNode.addChildNode(meshNode)
                }
            }

            scene.rootNode.addChildNode(rootNode)

            // Setup camera
            let cameraNode = SCNNode()
            cameraNode.camera = SCNCamera()
            cameraNode.position = SCNVector3(0, 0, 2)
            scene.rootNode.addChildNode(cameraNode)

            // Add lighting
            let lightNode = SCNNode()
            lightNode.light = SCNLight()
            lightNode.light?.type = .omni
            lightNode.position = SCNVector3(0, 2, 2)
            scene.rootNode.addChildNode(lightNode)

            let ambientLightNode = SCNNode()
            ambientLightNode.light = SCNLight()
            ambientLightNode.light?.type = .ambient
            ambientLightNode.light?.color = UIColor.darkGray
            scene.rootNode.addChildNode(ambientLightNode)

            // Render to image
            let renderer = SCNRenderer(device: metalDevice, options: nil)
            renderer.scene = scene

            let image = renderer.snapshot(atTime: 0, with: size, antialiasingMode: .multisampling4X)

            // Save to file
            if let pngData = image.pngData() {
                let filename = "body_scan_thumb_\(UUID().uuidString.prefix(8)).png"
                let fileURL = scansDirectory.appendingPathComponent(filename)

                do {
                    try pngData.write(to: fileURL)
                    DispatchQueue.main.async {
                        completion(.success(fileURL))
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion(.failure(error))
                    }
                }
            } else {
                DispatchQueue.main.async {
                    completion(.failure(MeshExportError.thumbnailGenerationFailed))
                }
            }
        }
    }

    /// Delete a scan file
    public static func deleteScan(at url: URL) -> Bool {
        do {
            try FileManager.default.removeItem(at: url)
            return true
        } catch {
            print("Failed to delete scan: \(error)")
            return false
        }
    }

    /// Get total vertex count from mesh anchors
    @available(iOS 14.0, *)
    public static func getVertexCount(meshAnchors: [ARMeshAnchor]) -> Int {
        return meshAnchors.reduce(0) { $0 + $1.geometry.vertices.count }
    }
}

// MARK: - Helper Extensions

@available(iOS 14.0, *)
extension ARGeometrySource {
    func vertex(at index: Int) -> SIMD3<Float> {
        let pointer = buffer.contents().advanced(by: offset + stride * index)
        return pointer.assumingMemoryBound(to: SIMD3<Float>.self).pointee
    }

    func normal(at index: Int) -> SIMD3<Float> {
        let pointer = buffer.contents().advanced(by: offset + stride * index)
        return pointer.assumingMemoryBound(to: SIMD3<Float>.self).pointee
    }
}

@available(iOS 14.0, *)
extension ARGeometryElement {
    func face(at index: Int) -> SIMD3<UInt32> {
        let pointer = buffer.contents().advanced(by: index * MemoryLayout<SIMD3<UInt32>>.size)
        return pointer.assumingMemoryBound(to: SIMD3<UInt32>.self).pointee
    }
}

// MARK: - Errors

enum MeshExportError: Error, LocalizedError {
    case exportFailed(String)
    case thumbnailGenerationFailed
    case noMeshData
    case invalidFormat

    var errorDescription: String? {
        switch self {
        case .exportFailed(let reason):
            return "Failed to export mesh: \(reason)"
        case .thumbnailGenerationFailed:
            return "Failed to generate thumbnail"
        case .noMeshData:
            return "No mesh data available"
        case .invalidFormat:
            return "Invalid export format specified"
        }
    }
}
