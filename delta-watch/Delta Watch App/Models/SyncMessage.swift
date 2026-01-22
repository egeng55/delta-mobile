import Foundation

// MARK: - Message Types (iPhone -> Watch)

enum WatchMessageType: String, Codable {
    case userAuthenticated = "user_authenticated"
    case userLoggedOut = "user_logged_out"
    case workoutUpdated = "workout_updated"
    case settingsUpdated = "settings_updated"
    case dailyLogUpdated = "daily_log_updated"
    case menstrualPhaseUpdated = "menstrual_phase_updated"
    case syncResponse = "sync_response"
    case workoutStartedFromPhone = "workout_started_from_phone"
    case workoutEndedFromPhone = "workout_ended_from_phone"
}

// MARK: - Message Types (Watch -> iPhone)

enum PhoneMessageType: String, Codable {
    case requestSync = "request_sync"
    case exerciseCompleted = "exercise_completed"
    case workoutStatusChanged = "workout_status_changed"
    case voiceLogSubmitted = "voice_log_submitted"
    case healthDataCaptured = "health_data_captured"
    case workoutStartedFromWatch = "workout_started_from_watch"
    case workoutEndedFromWatch = "workout_ended_from_watch"
}

// MARK: - Sync Payloads

struct WatchSyncPayload: Codable {
    let messageType: String
    let timestamp: Date
    let data: SyncData

    init(messageType: WatchMessageType, data: SyncData) {
        self.messageType = messageType.rawValue
        self.timestamp = Date()
        self.data = data
    }
}

struct SyncData: Codable {
    // User authentication
    var userId: String?
    var isAuthenticated: Bool?

    // Workout data
    var workout: WatchWorkout?
    var exerciseId: String?
    var workoutStatus: String?

    // Daily log data
    var dailyLog: WatchDailyLog?

    // Menstrual cycle data
    var cyclePhase: CyclePhase?
    var cycleDay: Int?

    // Wellness data
    var wellnessScore: Int?

    // Voice log data
    var voiceLogText: String?

    // Health data from workout
    var averageHeartRate: Double?
    var totalCalories: Double?
    var workoutDuration: TimeInterval?

    // Complication data
    var complicationData: ComplicationData?

    init() {}

    // Convenience initializers
    static func auth(userId: String?, isAuthenticated: Bool) -> SyncData {
        var data = SyncData()
        data.userId = userId
        data.isAuthenticated = isAuthenticated
        return data
    }

    static func workout(_ workout: WatchWorkout) -> SyncData {
        var data = SyncData()
        data.workout = workout
        return data
    }

    static func exerciseCompleted(exerciseId: String, workoutId: String) -> SyncData {
        var data = SyncData()
        data.exerciseId = exerciseId
        data.workout = WatchWorkout(
            id: workoutId,
            name: "",
            exercises: [],
            estimatedDuration: 0,
            status: .inProgress
        )
        return data
    }

    static func voiceLog(text: String) -> SyncData {
        var data = SyncData()
        data.voiceLogText = text
        return data
    }

    static func healthData(heartRate: Double?, calories: Double?, duration: TimeInterval) -> SyncData {
        var data = SyncData()
        data.averageHeartRate = heartRate
        data.totalCalories = calories
        data.workoutDuration = duration
        return data
    }
}

// MARK: - Phone Message

struct PhoneMessage: Codable {
    let messageType: String
    let timestamp: Date
    let data: SyncData

    init(messageType: PhoneMessageType, data: SyncData) {
        self.messageType = messageType.rawValue
        self.timestamp = Date()
        self.data = data
    }

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "type": messageType,
            "timestamp": timestamp.timeIntervalSince1970
        ]

        if let encoded = try? JSONEncoder().encode(data),
           let jsonDict = try? JSONSerialization.jsonObject(with: encoded) as? [String: Any] {
            dict["data"] = jsonDict
        }

        return dict
    }
}

// MARK: - Dictionary Conversion

extension WatchSyncPayload {
    init?(from dictionary: [String: Any]) {
        guard let typeString = dictionary["type"] as? String,
              let timestampInterval = dictionary["timestamp"] as? TimeInterval else {
            return nil
        }

        self.messageType = typeString
        self.timestamp = Date(timeIntervalSince1970: timestampInterval)

        if let dataDict = dictionary["data"] as? [String: Any],
           let jsonData = try? JSONSerialization.data(withJSONObject: dataDict),
           let syncData = try? JSONDecoder().decode(SyncData.self, from: jsonData) {
            self.data = syncData
        } else {
            self.data = SyncData()
        }
    }
}
