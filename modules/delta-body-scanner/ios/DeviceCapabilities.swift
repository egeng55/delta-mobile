import Foundation
import ARKit
import UIKit

/// Detects device capabilities for 3D body scanning
public class DeviceCapabilities {

    /// Check if device has LiDAR sensor (iPhone 12 Pro+, iPad Pro)
    public static var hasLiDAR: Bool {
        if #available(iOS 14.0, *) {
            return ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
        }
        return false
    }

    /// Check if device supports photogrammetry (iOS 17+, A12+ chip)
    public static var supportsPhotogrammetry: Bool {
        if #available(iOS 17.0, *) {
            // Photogrammetry requires iOS 17+ and sufficient processing power
            // Available on A12 Bionic and later (iPhone XS/XR and newer)
            return true
        }
        return false
    }

    /// Check if ARKit is supported at all
    public static var supportsARKit: Bool {
        return ARWorldTrackingConfiguration.isSupported
    }

    /// Check if body tracking is supported (A12+ with iOS 13+)
    public static var supportsBodyTracking: Bool {
        if #available(iOS 13.0, *) {
            return ARBodyTrackingConfiguration.isSupported
        }
        return false
    }

    /// Check if person segmentation is supported
    public static var supportsPersonSegmentation: Bool {
        if #available(iOS 14.0, *) {
            return ARWorldTrackingConfiguration.supportsFrameSemantics(.personSegmentation)
        }
        return false
    }

    /// Get the device model identifier
    public static var deviceModel: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
        return identifier
    }

    /// Get iOS version string
    public static var iosVersion: String {
        return UIDevice.current.systemVersion
    }

    /// Get supported scan methods for this device
    public static var supportedMethods: [String] {
        var methods: [String] = []

        if hasLiDAR {
            methods.append("lidar")
        }

        if supportsPhotogrammetry {
            methods.append("photogrammetry")
        }

        // Template-based fallback is always available
        methods.append("template")

        return methods
    }

    /// Get full capabilities dictionary for JS bridge
    public static var capabilities: [String: Any] {
        return [
            "hasLiDAR": hasLiDAR,
            "supportsPhotogrammetry": supportsPhotogrammetry,
            "supportsARKit": supportsARKit,
            "supportsBodyTracking": supportsBodyTracking,
            "supportsPersonSegmentation": supportsPersonSegmentation,
            "supportedMethods": supportedMethods,
            "deviceModel": deviceModel,
            "iosVersion": iosVersion
        ]
    }
}
