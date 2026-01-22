import Foundation
import WatchConnectivity
import Combine

class WatchConnectivityManager: NSObject, ObservableObject {
    static let shared = WatchConnectivityManager()

    // MARK: - Published Properties

    @Published var isSessionActivated = false
    @Published var isPhoneReachable = false
    @Published var lastSyncTime: Date?
    @Published var syncError: WatchSyncError?

    // MARK: - Private Properties

    private var session: WCSession?
    private var pendingMessages: [[String: Any]] = []

    // MARK: - Initialization

    private override init() {
        super.init()
    }

    // MARK: - Session Management

    func activateSession() {
        guard WCSession.isSupported() else {
            print("WCSession not supported on this device")
            return
        }

        session = WCSession.default
        session?.delegate = self
        session?.activate()
    }

    // MARK: - Message Sending

    func requestSync() {
        let message = PhoneMessage(
            messageType: .requestSync,
            data: SyncData()
        )
        sendMessage(message.toDictionary())
    }

    func sendExerciseCompleted(exerciseId: String, workoutId: String) {
        let message = PhoneMessage(
            messageType: .exerciseCompleted,
            data: .exerciseCompleted(exerciseId: exerciseId, workoutId: workoutId)
        )
        sendMessage(message.toDictionary())
    }

    func sendWorkoutStarted(workoutId: String) {
        var data = SyncData()
        data.workout = WatchWorkout(
            id: workoutId,
            name: "",
            exercises: [],
            estimatedDuration: 0,
            status: .inProgress,
            startedAt: Date()
        )
        let message = PhoneMessage(
            messageType: .workoutStartedFromWatch,
            data: data
        )
        sendMessage(message.toDictionary())
    }

    func sendWorkoutEnded(workoutId: String, healthData: SyncData) {
        var data = healthData
        data.workout = WatchWorkout(
            id: workoutId,
            name: "",
            exercises: [],
            estimatedDuration: 0,
            status: .completed,
            completedAt: Date()
        )
        let message = PhoneMessage(
            messageType: .workoutEndedFromWatch,
            data: data
        )
        sendMessage(message.toDictionary())
    }

    func sendVoiceLog(text: String) {
        let message = PhoneMessage(
            messageType: .voiceLogSubmitted,
            data: .voiceLog(text: text)
        )
        sendMessage(message.toDictionary())
    }

    func sendHealthData(heartRate: Double?, calories: Double?, duration: TimeInterval) {
        let message = PhoneMessage(
            messageType: .healthDataCaptured,
            data: .healthData(heartRate: heartRate, calories: calories, duration: duration)
        )
        sendMessage(message.toDictionary())
    }

    // MARK: - Private Methods

    private func sendMessage(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)? = nil) {
        guard let session = session else {
            syncError = .sessionNotActivated
            pendingMessages.append(message)
            return
        }

        guard session.isReachable else {
            // Use transferUserInfo for background delivery
            session.transferUserInfo(message)
            return
        }

        session.sendMessage(message, replyHandler: replyHandler) { [weak self] error in
            print("Error sending message: \(error.localizedDescription)")
            self?.syncError = .unknown(error.localizedDescription)
            // Queue for retry via transferUserInfo
            session.transferUserInfo(message)
        }
    }

    private func processPendingMessages() {
        guard let session = session, session.isReachable else { return }

        let messages = pendingMessages
        pendingMessages.removeAll()

        for message in messages {
            sendMessage(message)
        }
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isSessionActivated = activationState == .activated

            if let error = error {
                self.syncError = .unknown(error.localizedDescription)
            } else if activationState == .activated {
                self.processPendingMessages()
            }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isPhoneReachable = session.isReachable

            if session.isReachable {
                self.processPendingMessages()
            }
        }
    }

    // Handle messages from iPhone
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncomingMessage(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleIncomingMessage(message)
        replyHandler(["received": true])
    }

    // Handle user info transfers (background)
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleIncomingMessage(userInfo)
    }

    // Handle application context
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleIncomingMessage(applicationContext)
    }

    private func handleIncomingMessage(_ message: [String: Any]) {
        guard let payload = WatchSyncPayload(from: message) else {
            print("Failed to parse incoming message")
            return
        }

        DispatchQueue.main.async {
            self.lastSyncTime = Date()
            self.processPayload(payload)
        }
    }

    private func processPayload(_ payload: WatchSyncPayload) {
        guard let messageType = WatchMessageType(rawValue: payload.messageType) else {
            print("Unknown message type: \(payload.messageType)")
            return
        }

        let cacheManager = CacheManager.shared

        switch messageType {
        case .userAuthenticated:
            cacheManager.updateAuth(
                userId: payload.data.userId,
                isAuthenticated: payload.data.isAuthenticated ?? false
            )
            NotificationCenter.default.post(name: .authStateDidChange, object: nil)

        case .userLoggedOut:
            cacheManager.clearCache()
            NotificationCenter.default.post(name: .authStateDidChange, object: nil)

        case .workoutUpdated:
            if let workout = payload.data.workout {
                cacheManager.updateWorkout(workout)
            }

        case .settingsUpdated:
            // Handle settings updates if needed
            break

        case .dailyLogUpdated:
            if let dailyLog = payload.data.dailyLog {
                cacheManager.updateDailyLog(dailyLog)
            }

        case .menstrualPhaseUpdated:
            cacheManager.updateMenstrualPhase(
                phase: payload.data.cyclePhase,
                day: payload.data.cycleDay
            )

        case .syncResponse:
            // Full sync response - update all cached data
            if let workout = payload.data.workout {
                cacheManager.updateWorkout(workout)
            }
            if let dailyLog = payload.data.dailyLog {
                cacheManager.updateDailyLog(dailyLog)
            }
            if let wellnessScore = payload.data.wellnessScore {
                cacheManager.updateWellnessScore(wellnessScore)
            }
            if let complicationData = payload.data.complicationData {
                cacheManager.updateComplicationData(complicationData)
            }
            cacheManager.updateAuth(
                userId: payload.data.userId,
                isAuthenticated: payload.data.isAuthenticated ?? false
            )
            NotificationCenter.default.post(name: .syncDidComplete, object: nil)

        case .workoutStartedFromPhone:
            if let workout = payload.data.workout {
                cacheManager.updateWorkout(workout)
            }
            NotificationCenter.default.post(name: .workoutDidStart, object: payload.data.workout)

        case .workoutEndedFromPhone:
            if let workout = payload.data.workout {
                cacheManager.updateWorkout(workout)
            }
            NotificationCenter.default.post(name: .workoutDidEnd, object: nil)
        }
    }
}
