import ExpoModulesCore
import SceneKit
import UIKit

/// SceneKit-based 3D model viewer for displaying scanned meshes
public class Model3DViewWrapper: ExpoView {

    // MARK: - Properties

    var modelUri: String = "" {
        didSet {
            if modelUri != oldValue && !modelUri.isEmpty {
                loadModel()
            }
        }
    }

    var autoRotate: Bool = true {
        didSet {
            updateAutoRotation()
        }
    }

    var allowUserInteraction: Bool = true {
        didSet {
            sceneView?.allowsCameraControl = allowUserInteraction
        }
    }

    var backgroundColorHex: String = "#000000" {
        didSet {
            sceneView?.backgroundColor = UIColor(hex: backgroundColorHex) ?? .black
        }
    }

    var lightingIntensity: CGFloat = 1.0 {
        didSet {
            updateLighting()
        }
    }

    // Event dispatchers
    let onModelLoaded = EventDispatcher()
    let onModelError = EventDispatcher()

    // Private
    private var sceneView: SCNView?
    private var modelNode: SCNNode?
    private var rotationAction: SCNAction?

    // MARK: - Lifecycle

    public override func layoutSubviews() {
        super.layoutSubviews()

        if sceneView == nil {
            setupSceneView()
        }

        sceneView?.frame = bounds
    }

    // MARK: - Setup

    private func setupSceneView() {
        let view = SCNView(frame: bounds)
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.backgroundColor = UIColor(hex: backgroundColorHex) ?? .black
        view.allowsCameraControl = allowUserInteraction
        view.antialiasingMode = .multisampling4X
        view.autoenablesDefaultLighting = false

        // Create empty scene
        let scene = SCNScene()
        view.scene = scene

        // Setup camera
        let cameraNode = SCNNode()
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.automaticallyAdjustsZRange = true
        cameraNode.position = SCNVector3(0, 0, 2.5)
        scene.rootNode.addChildNode(cameraNode)

        // Setup lighting
        setupLighting(in: scene)

        addSubview(view)
        sceneView = view

        // Load model if URI is already set
        if !modelUri.isEmpty {
            loadModel()
        }
    }

    private func setupLighting(in scene: SCNScene) {
        // Key light
        let keyLight = SCNNode()
        keyLight.light = SCNLight()
        keyLight.light?.type = .directional
        keyLight.light?.intensity = 800 * lightingIntensity
        keyLight.light?.color = UIColor.white
        keyLight.light?.castsShadow = true
        keyLight.eulerAngles = SCNVector3(-Float.pi / 4, Float.pi / 4, 0)
        keyLight.name = "keyLight"
        scene.rootNode.addChildNode(keyLight)

        // Fill light
        let fillLight = SCNNode()
        fillLight.light = SCNLight()
        fillLight.light?.type = .directional
        fillLight.light?.intensity = 400 * lightingIntensity
        fillLight.light?.color = UIColor(white: 0.8, alpha: 1.0)
        fillLight.eulerAngles = SCNVector3(-Float.pi / 6, -Float.pi / 4, 0)
        fillLight.name = "fillLight"
        scene.rootNode.addChildNode(fillLight)

        // Ambient light
        let ambientLight = SCNNode()
        ambientLight.light = SCNLight()
        ambientLight.light?.type = .ambient
        ambientLight.light?.intensity = 300 * lightingIntensity
        ambientLight.light?.color = UIColor(white: 0.6, alpha: 1.0)
        ambientLight.name = "ambientLight"
        scene.rootNode.addChildNode(ambientLight)

        // Rim light (backlight)
        let rimLight = SCNNode()
        rimLight.light = SCNLight()
        rimLight.light?.type = .directional
        rimLight.light?.intensity = 200 * lightingIntensity
        rimLight.light?.color = UIColor(white: 0.9, alpha: 1.0)
        rimLight.eulerAngles = SCNVector3(Float.pi / 6, Float.pi, 0)
        rimLight.name = "rimLight"
        scene.rootNode.addChildNode(rimLight)
    }

    private func updateLighting() {
        guard let scene = sceneView?.scene else { return }

        for lightName in ["keyLight", "fillLight", "ambientLight", "rimLight"] {
            if let lightNode = scene.rootNode.childNode(withName: lightName, recursively: false) {
                switch lightName {
                case "keyLight":
                    lightNode.light?.intensity = 800 * lightingIntensity
                case "fillLight":
                    lightNode.light?.intensity = 400 * lightingIntensity
                case "ambientLight":
                    lightNode.light?.intensity = 300 * lightingIntensity
                case "rimLight":
                    lightNode.light?.intensity = 200 * lightingIntensity
                default:
                    break
                }
            }
        }
    }

    // MARK: - Model Loading

    private func loadModel() {
        guard let url = URL(string: modelUri) else {
            onModelError(["error": "Invalid model URI"])
            return
        }

        // Remove existing model
        modelNode?.removeFromParentNode()
        modelNode = nil

        // Load on background thread
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                let scene: SCNScene

                if url.pathExtension.lowercased() == "usdz" {
                    // Load USDZ file
                    scene = try SCNScene(url: url, options: [
                        .checkConsistency: true,
                        .flattenScene: true
                    ])
                } else {
                    // Try loading as generic 3D file
                    scene = try SCNScene(url: url, options: nil)
                }

                // Get root node of loaded model
                let loadedNode = SCNNode()
                for child in scene.rootNode.childNodes {
                    loadedNode.addChildNode(child.clone())
                }

                // Center and scale the model
                self?.centerAndScaleNode(loadedNode)

                DispatchQueue.main.async {
                    self?.addModelToScene(loadedNode)
                }
            } catch {
                DispatchQueue.main.async {
                    self?.onModelError(["error": error.localizedDescription])
                }
            }
        }
    }

    private func centerAndScaleNode(_ node: SCNNode) {
        // Calculate bounding box
        let (minVec, maxVec) = node.boundingBox

        // Calculate center
        let centerX = (minVec.x + maxVec.x) / 2
        let centerY = (minVec.y + maxVec.y) / 2
        let centerZ = (minVec.z + maxVec.z) / 2

        // Move to center
        node.position = SCNVector3(-centerX, -centerY, -centerZ)

        // Calculate scale to fit in view
        let width = maxVec.x - minVec.x
        let height = maxVec.y - minVec.y
        let depth = maxVec.z - minVec.z
        let maxDimension = max(width, max(height, depth))

        if maxDimension > 0 {
            let targetSize: Float = 1.5
            let scale = targetSize / maxDimension
            node.scale = SCNVector3(scale, scale, scale)
        }
    }

    private func addModelToScene(_ node: SCNNode) {
        guard let scene = sceneView?.scene else { return }

        // Create container node for rotation
        let containerNode = SCNNode()
        containerNode.addChildNode(node)
        containerNode.name = "modelContainer"

        scene.rootNode.addChildNode(containerNode)
        modelNode = containerNode

        // Apply auto-rotation if enabled
        updateAutoRotation()

        // Notify success
        onModelLoaded([:])
    }

    // MARK: - Auto Rotation

    private func updateAutoRotation() {
        guard let modelNode = modelNode else { return }

        modelNode.removeAllActions()

        if autoRotate {
            let rotation = SCNAction.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0, duration: 20)
            let forever = SCNAction.repeatForever(rotation)
            modelNode.runAction(forever, forKey: "autoRotate")
        }
    }

    // MARK: - Public Methods

    /// Reset camera to default position
    public func resetCamera() {
        sceneView?.pointOfView?.position = SCNVector3(0, 0, 2.5)
        sceneView?.pointOfView?.eulerAngles = SCNVector3(0, 0, 0)
    }

    /// Take snapshot of current view
    public func snapshot() -> UIImage? {
        return sceneView?.snapshot()
    }
}

// MARK: - UIColor Extension

extension UIColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let length = hexSanitized.count
        let r, g, b, a: CGFloat

        if length == 6 {
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgb & 0x0000FF) / 255.0
            a = 1.0
        } else if length == 8 {
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgb & 0x000000FF) / 255.0
        } else {
            return nil
        }

        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
