import Foundation
import HealthKit

// MARK: - Workout Models

struct WatchWorkout: Codable, Identifiable {
    let id: String
    let name: String
    let exercises: [WatchExercise]
    let estimatedDuration: Int // in minutes
    var status: WorkoutStatus
    var startedAt: Date?
    var completedAt: Date?

    var completedExercisesCount: Int {
        exercises.filter { $0.isCompleted }.count
    }

    var progress: Double {
        guard !exercises.isEmpty else { return 0 }
        return Double(completedExercisesCount) / Double(exercises.count)
    }
}

struct WatchExercise: Codable, Identifiable {
    let id: String
    let name: String
    let sets: Int
    let reps: Int
    let weight: Double?
    let weightUnit: String?
    var isCompleted: Bool
    var completedAt: Date?

    var displayWeight: String? {
        guard let weight = weight, let unit = weightUnit else { return nil }
        return "\(Int(weight))\(unit)"
    }

    var setRepDisplay: String {
        "\(sets)x\(reps)"
    }
}

enum WorkoutStatus: String, Codable {
    case scheduled
    case inProgress = "in_progress"
    case completed
    case skipped
}

// MARK: - Daily Log Models

struct WatchDailyLog: Codable {
    let date: String
    var energyLevel: Int?
    var stressLevel: Int?
    var sleepQuality: Int?
    var notes: String?
    var lastUpdated: Date?
}

// MARK: - Menstrual Cycle Models

enum CyclePhase: String, Codable {
    case menstrual
    case follicular
    case ovulation
    case luteal
    case unknown

    var displayName: String {
        switch self {
        case .menstrual: return "Menstrual"
        case .follicular: return "Follicular"
        case .ovulation: return "Ovulation"
        case .luteal: return "Luteal"
        case .unknown: return "Unknown"
        }
    }

    var emoji: String {
        switch self {
        case .menstrual: return "🔴"
        case .follicular: return "🌱"
        case .ovulation: return "🌸"
        case .luteal: return "🌙"
        case .unknown: return "⚪"
        }
    }
}

// MARK: - Workout Session Data

struct WorkoutSessionData: Codable {
    var heartRate: Double?
    var activeCalories: Double?
    var elapsedTime: TimeInterval
    var currentExerciseIndex: Int

    init() {
        self.heartRate = nil
        self.activeCalories = nil
        self.elapsedTime = 0
        self.currentExerciseIndex = 0
    }
}

// MARK: - Complication Data

struct ComplicationData: Codable {
    let wellnessScore: Int?
    let nextWorkoutName: String?
    let nextWorkoutTime: Date?
    let streakDays: Int
    let cycleDay: Int?

    static var empty: ComplicationData {
        ComplicationData(
            wellnessScore: nil,
            nextWorkoutName: nil,
            nextWorkoutTime: nil,
            streakDays: 0,
            cycleDay: nil
        )
    }
}

// MARK: - HealthKit Workout Type Mapping

extension WatchWorkout {
    var healthKitActivityType: HKWorkoutActivityType {
        let lowercaseName = name.lowercased()
        if lowercaseName.contains("run") {
            return .running
        } else if lowercaseName.contains("walk") {
            return .walking
        } else if lowercaseName.contains("cycle") || lowercaseName.contains("bike") {
            return .cycling
        } else if lowercaseName.contains("swim") {
            return .swimming
        } else if lowercaseName.contains("yoga") {
            return .yoga
        } else if lowercaseName.contains("hiit") {
            return .highIntensityIntervalTraining
        } else {
            return .traditionalStrengthTraining
        }
    }
}
