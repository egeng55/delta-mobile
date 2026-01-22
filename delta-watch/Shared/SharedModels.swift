import Foundation

// MARK: - Shared Constants

struct WatchConstants {
    static let syncTimeoutInterval: TimeInterval = 5 * 60 // 5 minutes
    static let complicationUpdateBudget = 50 // per day
    static let cacheExpirationInterval: TimeInterval = 24 * 60 * 60 // 24 hours

    struct MessageKeys {
        static let type = "type"
        static let timestamp = "timestamp"
        static let data = "data"
        static let userId = "userId"
        static let workoutId = "workoutId"
        static let exerciseId = "exerciseId"
    }
}

// MARK: - Shared Protocols

protocol WatchSyncable: Codable {
    var syncId: String { get }
    var lastModified: Date { get }
}

// MARK: - Error Types

enum WatchSyncError: Error, LocalizedError {
    case sessionNotActivated
    case sessionNotReachable
    case encodingFailed
    case decodingFailed
    case timeout
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .sessionNotActivated:
            return "Watch session is not activated"
        case .sessionNotReachable:
            return "iPhone is not reachable"
        case .encodingFailed:
            return "Failed to encode message"
        case .decodingFailed:
            return "Failed to decode message"
        case .timeout:
            return "Request timed out"
        case .unknown(let message):
            return message
        }
    }
}

enum HealthKitError: Error, LocalizedError {
    case notAvailable
    case authorizationDenied
    case workoutSessionFailed
    case queryFailed(String)

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "HealthKit is not available on this device"
        case .authorizationDenied:
            return "HealthKit authorization was denied"
        case .workoutSessionFailed:
            return "Failed to start workout session"
        case .queryFailed(let reason):
            return "Health query failed: \(reason)"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let workoutDidStart = Notification.Name("workoutDidStart")
    static let workoutDidEnd = Notification.Name("workoutDidEnd")
    static let exerciseDidComplete = Notification.Name("exerciseDidComplete")
    static let syncDidComplete = Notification.Name("syncDidComplete")
    static let authStateDidChange = Notification.Name("authStateDidChange")
}
