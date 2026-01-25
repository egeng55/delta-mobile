import Foundation
import HealthKit

/// HealthKitManager provides access to HealthKit data on the iPhone.
/// Reads sleep analysis, heart rate variability, resting heart rate, and other health metrics.
class HealthKitManager {
    static let shared = HealthKitManager()

    private let healthStore = HKHealthStore()
    private var isAuthorized = false

    // MARK: - HealthKit Types

    private let typesToRead: Set<HKSampleType> = {
        var types: Set<HKSampleType> = [
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
            HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
        ]
        // HRV is only available on iOS 11+
        if let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            types.insert(hrvType)
        }
        return types
    }()

    private init() {}

    // MARK: - Authorization

    func requestAuthorization(completion: @escaping (Bool, Error?) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false, NSError(domain: "HealthKit", code: -1, userInfo: [NSLocalizedDescriptionKey: "HealthKit is not available on this device"]))
            return
        }

        healthStore.requestAuthorization(toShare: nil, read: typesToRead) { [weak self] success, error in
            DispatchQueue.main.async {
                self?.isAuthorized = success
                completion(success, error)
            }
        }
    }

    func checkAuthorizationStatus() -> Bool {
        return HKHealthStore.isHealthDataAvailable() && isAuthorized
    }

    // MARK: - Sleep Analysis

    /// Get sleep data for a date range
    /// Returns array of sleep sessions with start/end times, duration, and sleep stages
    func getSleepData(from startDate: Date, to endDate: Date, completion: @escaping ([[String: Any]]?, Error?) -> Void) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(nil, NSError(domain: "HealthKit", code: -2, userInfo: [NSLocalizedDescriptionKey: "Sleep analysis not available"]))
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
            guard let samples = samples as? [HKCategorySample], error == nil else {
                DispatchQueue.main.async {
                    completion(nil, error)
                }
                return
            }

            // Group samples by night (sleep sessions)
            let sleepData = samples.compactMap { sample -> [String: Any]? in
                // Only include "in bed" or "asleep" samples
                guard sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue ||
                      sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                      sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                      sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                      sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue else {
                    return nil
                }

                let duration = sample.endDate.timeIntervalSince(sample.startDate)
                let sleepStage: String
                switch sample.value {
                case HKCategoryValueSleepAnalysis.inBed.rawValue:
                    sleepStage = "inBed"
                case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                    sleepStage = "core"
                case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                    sleepStage = "deep"
                case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                    sleepStage = "rem"
                default:
                    sleepStage = "asleep"
                }

                return [
                    "startDate": ISO8601DateFormatter().string(from: sample.startDate),
                    "endDate": ISO8601DateFormatter().string(from: sample.endDate),
                    "durationSeconds": duration,
                    "durationHours": duration / 3600,
                    "stage": sleepStage,
                    "source": sample.sourceRevision.source.name
                ]
            }

            DispatchQueue.main.async {
                completion(sleepData, nil)
            }
        }

        healthStore.execute(query)
    }

    /// Get aggregated sleep summary for a specific night
    func getSleepSummary(for date: Date, completion: @escaping ([String: Any]?, Error?) -> Void) {
        // Get sleep from 6PM previous day to 12PM current day (covers typical sleep window)
        let calendar = Calendar.current
        var startComponents = calendar.dateComponents([.year, .month, .day], from: date)
        startComponents.hour = 18
        guard let startDate = calendar.date(from: startComponents),
              let adjustedStart = calendar.date(byAdding: .day, value: -1, to: startDate),
              let endDate = calendar.date(byAdding: .hour, value: 18, to: startDate) else {
            completion(nil, NSError(domain: "HealthKit", code: -3, userInfo: [NSLocalizedDescriptionKey: "Invalid date"]))
            return
        }

        getSleepData(from: adjustedStart, to: endDate) { sleepData, error in
            guard let sleepData = sleepData, error == nil else {
                completion(nil, error)
                return
            }

            // Calculate totals by stage
            var totalInBed: TimeInterval = 0
            var totalAsleep: TimeInterval = 0
            var totalDeep: TimeInterval = 0
            var totalREM: TimeInterval = 0
            var totalCore: TimeInterval = 0
            var earliestStart: Date?
            var latestEnd: Date?

            let formatter = ISO8601DateFormatter()

            for session in sleepData {
                guard let durationSeconds = session["durationSeconds"] as? TimeInterval,
                      let stage = session["stage"] as? String,
                      let startDateStr = session["startDate"] as? String,
                      let endDateStr = session["endDate"] as? String,
                      let sessionStart = formatter.date(from: startDateStr),
                      let sessionEnd = formatter.date(from: endDateStr) else {
                    continue
                }

                if earliestStart == nil || sessionStart < earliestStart! {
                    earliestStart = sessionStart
                }
                if latestEnd == nil || sessionEnd > latestEnd! {
                    latestEnd = sessionEnd
                }

                switch stage {
                case "inBed":
                    totalInBed += durationSeconds
                case "deep":
                    totalDeep += durationSeconds
                    totalAsleep += durationSeconds
                case "rem":
                    totalREM += durationSeconds
                    totalAsleep += durationSeconds
                case "core":
                    totalCore += durationSeconds
                    totalAsleep += durationSeconds
                default:
                    totalAsleep += durationSeconds
                }
            }

            let summary: [String: Any] = [
                "date": ISO8601DateFormatter().string(from: date),
                "totalSleepHours": totalAsleep / 3600,
                "totalInBedHours": (totalInBed > 0 ? totalInBed : totalAsleep) / 3600,
                "deepSleepHours": totalDeep / 3600,
                "remSleepHours": totalREM / 3600,
                "coreSleepHours": totalCore / 3600,
                "sleepEfficiency": totalInBed > 0 ? (totalAsleep / totalInBed) * 100 : 0,
                "bedTime": earliestStart != nil ? ISO8601DateFormatter().string(from: earliestStart!) : nil,
                "wakeTime": latestEnd != nil ? ISO8601DateFormatter().string(from: latestEnd!) : nil,
                "hasData": !sleepData.isEmpty
            ]

            completion(summary, nil)
        }
    }

    // MARK: - Heart Rate Variability

    /// Get HRV (SDNN) readings for a date range
    func getHRV(from startDate: Date, to endDate: Date, completion: @escaping ([[String: Any]]?, Error?) -> Void) {
        guard let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else {
            completion(nil, NSError(domain: "HealthKit", code: -4, userInfo: [NSLocalizedDescriptionKey: "HRV not available"]))
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: hrvType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
            guard let samples = samples as? [HKQuantitySample], error == nil else {
                DispatchQueue.main.async {
                    completion(nil, error)
                }
                return
            }

            let hrvData = samples.map { sample -> [String: Any] in
                let hrvValue = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                return [
                    "date": ISO8601DateFormatter().string(from: sample.startDate),
                    "hrvMs": hrvValue,
                    "source": sample.sourceRevision.source.name
                ]
            }

            DispatchQueue.main.async {
                completion(hrvData, nil)
            }
        }

        healthStore.execute(query)
    }

    // MARK: - Resting Heart Rate

    /// Get resting heart rate readings for a date range
    func getRestingHeartRate(from startDate: Date, to endDate: Date, completion: @escaping ([[String: Any]]?, Error?) -> Void) {
        guard let rhrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) else {
            completion(nil, NSError(domain: "HealthKit", code: -5, userInfo: [NSLocalizedDescriptionKey: "Resting heart rate not available"]))
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: rhrType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
            guard let samples = samples as? [HKQuantitySample], error == nil else {
                DispatchQueue.main.async {
                    completion(nil, error)
                }
                return
            }

            let rhrData = samples.map { sample -> [String: Any] in
                let bpm = sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
                return [
                    "date": ISO8601DateFormatter().string(from: sample.startDate),
                    "bpm": bpm,
                    "source": sample.sourceRevision.source.name
                ]
            }

            DispatchQueue.main.async {
                completion(rhrData, nil)
            }
        }

        healthStore.execute(query)
    }

    // MARK: - Step Count

    /// Get step count for a specific date
    func getStepCount(for date: Date, completion: @escaping (Int?, Error?) -> Void) {
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            completion(nil, NSError(domain: "HealthKit", code: -6, userInfo: [NSLocalizedDescriptionKey: "Step count not available"]))
            return
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            completion(nil, NSError(domain: "HealthKit", code: -7, userInfo: [NSLocalizedDescriptionKey: "Invalid date"]))
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
            DispatchQueue.main.async {
                guard let result = result, let sum = result.sumQuantity() else {
                    completion(0, error)
                    return
                }
                let steps = Int(sum.doubleValue(for: HKUnit.count()))
                completion(steps, nil)
            }
        }

        healthStore.execute(query)
    }
}
