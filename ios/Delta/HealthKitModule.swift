import Foundation
import React

/// React Native bridge for HealthKit functionality
@objc(HealthKitModule)
class HealthKitModule: NSObject {

    private let healthKitManager = HealthKitManager.shared
    private let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Authorization

    @objc
    func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        healthKitManager.requestAuthorization { success, error in
            if let error = error {
                reject("HEALTHKIT_AUTH_ERROR", error.localizedDescription, error)
            } else {
                resolve(["authorized": success])
            }
        }
    }

    @objc
    func isAuthorized(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let authorized = healthKitManager.checkAuthorizationStatus()
        resolve(["authorized": authorized])
    }

    // MARK: - Sleep Data

    /// Get sleep data for a date range
    /// Parameters: startDate (ISO string), endDate (ISO string)
    @objc
    func getSleepData(_ startDateString: String, endDateString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let startDate = dateFormatter.date(from: startDateString),
              let endDate = dateFormatter.date(from: endDateString) else {
            reject("INVALID_DATE", "Invalid date format. Use ISO8601.", nil)
            return
        }

        healthKitManager.getSleepData(from: startDate, to: endDate) { sleepData, error in
            if let error = error {
                reject("HEALTHKIT_SLEEP_ERROR", error.localizedDescription, error)
            } else {
                resolve(["sleepSessions": sleepData ?? []])
            }
        }
    }

    /// Get aggregated sleep summary for a specific date
    /// Parameters: date (ISO string)
    @objc
    func getSleepSummary(_ dateString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let date = dateFormatter.date(from: dateString) else {
            // Try parsing just the date part
            let simpleDateFormatter = DateFormatter()
            simpleDateFormatter.dateFormat = "yyyy-MM-dd"
            guard let date = simpleDateFormatter.date(from: dateString) else {
                reject("INVALID_DATE", "Invalid date format. Use ISO8601 or yyyy-MM-dd.", nil)
                return
            }

            healthKitManager.getSleepSummary(for: date) { summary, error in
                if let error = error {
                    reject("HEALTHKIT_SLEEP_ERROR", error.localizedDescription, error)
                } else {
                    resolve(summary ?? ["hasData": false])
                }
            }
            return
        }

        healthKitManager.getSleepSummary(for: date) { summary, error in
            if let error = error {
                reject("HEALTHKIT_SLEEP_ERROR", error.localizedDescription, error)
            } else {
                resolve(summary ?? ["hasData": false])
            }
        }
    }

    // MARK: - Heart Rate Variability

    /// Get HRV data for a date range
    @objc
    func getHRV(_ startDateString: String, endDateString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let startDate = dateFormatter.date(from: startDateString),
              let endDate = dateFormatter.date(from: endDateString) else {
            reject("INVALID_DATE", "Invalid date format. Use ISO8601.", nil)
            return
        }

        healthKitManager.getHRV(from: startDate, to: endDate) { hrvData, error in
            if let error = error {
                reject("HEALTHKIT_HRV_ERROR", error.localizedDescription, error)
            } else {
                resolve(["readings": hrvData ?? []])
            }
        }
    }

    // MARK: - Resting Heart Rate

    /// Get resting heart rate data for a date range
    @objc
    func getRestingHeartRate(_ startDateString: String, endDateString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let startDate = dateFormatter.date(from: startDateString),
              let endDate = dateFormatter.date(from: endDateString) else {
            reject("INVALID_DATE", "Invalid date format. Use ISO8601.", nil)
            return
        }

        healthKitManager.getRestingHeartRate(from: startDate, to: endDate) { rhrData, error in
            if let error = error {
                reject("HEALTHKIT_RHR_ERROR", error.localizedDescription, error)
            } else {
                resolve(["readings": rhrData ?? []])
            }
        }
    }

    // MARK: - Step Count

    /// Get step count for a specific date
    @objc
    func getStepCount(_ dateString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let simpleDateFormatter = DateFormatter()
        simpleDateFormatter.dateFormat = "yyyy-MM-dd"

        guard let date = simpleDateFormatter.date(from: dateString) ?? dateFormatter.date(from: dateString) else {
            reject("INVALID_DATE", "Invalid date format. Use ISO8601 or yyyy-MM-dd.", nil)
            return
        }

        healthKitManager.getStepCount(for: date) { steps, error in
            if let error = error {
                reject("HEALTHKIT_STEPS_ERROR", error.localizedDescription, error)
            } else {
                resolve(["steps": steps ?? 0, "date": dateString])
            }
        }
    }

    // MARK: - Combined Health Summary

    /// Get a combined health summary for today
    @objc
    func getTodayHealthSummary(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let today = Date()
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: today)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: startOfToday)!

        var summary: [String: Any] = [
            "date": ISO8601DateFormatter().string(from: today),
            "hasHealthKitAccess": healthKitManager.checkAuthorizationStatus()
        ]

        let group = DispatchGroup()

        // Get sleep summary
        group.enter()
        healthKitManager.getSleepSummary(for: today) { sleepSummary, _ in
            if let sleepSummary = sleepSummary {
                summary["sleep"] = sleepSummary
            }
            group.leave()
        }

        // Get step count
        group.enter()
        healthKitManager.getStepCount(for: today) { steps, _ in
            summary["steps"] = steps ?? 0
            group.leave()
        }

        // Get HRV (last 24 hours)
        group.enter()
        healthKitManager.getHRV(from: yesterday, to: today) { hrvData, _ in
            if let hrvData = hrvData, let latest = hrvData.first {
                summary["latestHRV"] = latest
            }
            group.leave()
        }

        // Get resting heart rate (last 24 hours)
        group.enter()
        healthKitManager.getRestingHeartRate(from: yesterday, to: today) { rhrData, _ in
            if let rhrData = rhrData, let latest = rhrData.first {
                summary["latestRestingHeartRate"] = latest
            }
            group.leave()
        }

        group.notify(queue: .main) {
            resolve(summary)
        }
    }
}
