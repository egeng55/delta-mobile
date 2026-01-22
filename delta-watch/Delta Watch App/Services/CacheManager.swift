import Foundation
import Combine

class CacheManager: ObservableObject {
    static let shared = CacheManager()

    // MARK: - Published Properties

    @Published var cache: WatchCache

    // MARK: - Private Properties

    private let userDefaults = UserDefaults.standard
    private let cacheKey = "delta_watch_cache"

    // MARK: - Initialization

    private init() {
        if let data = userDefaults.data(forKey: cacheKey),
           let decoded = try? JSONDecoder().decode(WatchCache.self, from: data) {
            self.cache = decoded
        } else {
            self.cache = WatchCache()
        }
    }

    // MARK: - Cache Operations

    func shouldRequestSync() -> Bool {
        guard let lastSync = cache.lastSyncTime else { return true }
        return Date().timeIntervalSince(lastSync) > WatchConstants.syncTimeoutInterval
    }

    func updateAuth(userId: String?, isAuthenticated: Bool) {
        cache.userId = userId
        cache.isAuthenticated = isAuthenticated
        cache.lastSyncTime = Date()
        saveCache()
    }

    func updateWorkout(_ workout: WatchWorkout) {
        cache.todayWorkout = workout
        cache.lastSyncTime = Date()
        saveCache()
    }

    func updateDailyLog(_ dailyLog: WatchDailyLog) {
        cache.dailyLog = dailyLog
        cache.lastSyncTime = Date()
        saveCache()
    }

    func updateMenstrualPhase(phase: CyclePhase?, day: Int?) {
        cache.menstrualPhase = phase
        cache.cycleDay = day
        cache.lastSyncTime = Date()
        saveCache()
    }

    func updateWellnessScore(_ score: Int) {
        cache.wellnessScore = score
        cache.lastSyncTime = Date()
        saveCache()
    }

    func updateComplicationData(_ data: ComplicationData) {
        cache.complicationData = data
        cache.lastSyncTime = Date()
        saveCache()
    }

    func markExerciseCompleted(exerciseId: String) {
        guard var workout = cache.todayWorkout else { return }

        if let index = workout.exercises.firstIndex(where: { $0.id == exerciseId }) {
            var exercise = workout.exercises[index]
            exercise.isCompleted = true
            exercise.completedAt = Date()

            var updatedExercises = workout.exercises
            updatedExercises[index] = exercise

            cache.todayWorkout = WatchWorkout(
                id: workout.id,
                name: workout.name,
                exercises: updatedExercises,
                estimatedDuration: workout.estimatedDuration,
                status: workout.status,
                startedAt: workout.startedAt,
                completedAt: workout.completedAt
            )
            saveCache()
        }
    }

    func updateWorkoutStatus(_ status: WorkoutStatus) {
        guard var workout = cache.todayWorkout else { return }

        cache.todayWorkout = WatchWorkout(
            id: workout.id,
            name: workout.name,
            exercises: workout.exercises,
            estimatedDuration: workout.estimatedDuration,
            status: status,
            startedAt: status == .inProgress ? Date() : workout.startedAt,
            completedAt: status == .completed ? Date() : workout.completedAt
        )
        saveCache()
    }

    func clearCache() {
        cache = WatchCache()
        saveCache()
    }

    // MARK: - Private Methods

    private func saveCache() {
        if let encoded = try? JSONEncoder().encode(cache) {
            userDefaults.set(encoded, forKey: cacheKey)
        }
    }
}

// MARK: - Watch Cache Model

struct WatchCache: Codable {
    var userId: String?
    var isAuthenticated: Bool = false
    var todayWorkout: WatchWorkout?
    var dailyLog: WatchDailyLog?
    var menstrualPhase: CyclePhase?
    var cycleDay: Int?
    var wellnessScore: Int?
    var complicationData: ComplicationData?
    var lastSyncTime: Date?

    init() {}
}
