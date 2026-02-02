//
//  HealthKitModule.swift
//  Delta
//
//  React Native bridge for HealthKit functionality
//

import Foundation
import HealthKit
import React

@objc(HealthKitModule)
class HealthKitModule: NSObject {

  private let healthStore = HKHealthStore()
  private let dateFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private let dayFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone.current
    return formatter
  }()

  // MARK: - Authorization

  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["authorized": false, "error": "HealthKit not available"])
      return
    }

    let readTypes: Set<HKObjectType> = [
      HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
      HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
      HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
      HKObjectType.quantityType(forIdentifier: .stepCount)!,
    ]

    healthStore.requestAuthorization(toShare: nil, read: readTypes) { success, error in
      if let error = error {
        resolve(["authorized": false, "error": error.localizedDescription])
      } else {
        resolve(["authorized": success])
      }
    }
  }

  @objc
  func isAuthorized(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["authorized": false])
      return
    }

    let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    let status = healthStore.authorizationStatus(for: sleepType)
    resolve(["authorized": status == .sharingAuthorized])
  }

  // MARK: - Sleep Data

  @objc
  func getSleepData(_ startDate: String,
                    endDate: String,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let start = dateFormatter.date(from: startDate),
          let end = dateFormatter.date(from: endDate) else {
      resolve(["sleepSessions": []])
      return
    }

    let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
      guard let samples = samples as? [HKCategorySample] else {
        resolve(["sleepSessions": []])
        return
      }

      let sessions = samples.map { sample -> [String: Any] in
        let duration = sample.endDate.timeIntervalSince(sample.startDate)
        let stage: String
        if #available(iOS 16.0, *) {
          switch sample.value {
          case HKCategoryValueSleepAnalysis.inBed.rawValue:
            stage = "inBed"
          case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
            stage = "core"
          case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
            stage = "deep"
          case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
            stage = "rem"
          default:
            stage = "asleep"
          }
        } else {
          switch sample.value {
          case HKCategoryValueSleepAnalysis.inBed.rawValue:
            stage = "inBed"
          default:
            stage = "asleep"
          }
        }

        return [
          "startDate": self.dateFormatter.string(from: sample.startDate),
          "endDate": self.dateFormatter.string(from: sample.endDate),
          "durationSeconds": duration,
          "durationHours": duration / 3600.0,
          "stage": stage,
          "source": sample.sourceRevision.source.name
        ]
      }

      resolve(["sleepSessions": sessions])
    }

    healthStore.execute(query)
  }

  @objc
  func getSleepSummary(_ dateString: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let date = dayFormatter.date(from: dateString) else {
      resolve(["hasData": false])
      return
    }

    // Get sleep data for the night before (6 PM previous day to 12 PM target day)
    let calendar = Calendar.current
    var startComponents = calendar.dateComponents([.year, .month, .day], from: date)
    startComponents.day! -= 1
    startComponents.hour = 18
    guard let startDate = calendar.date(from: startComponents) else {
      resolve(["hasData": false])
      return
    }

    var endComponents = calendar.dateComponents([.year, .month, .day], from: date)
    endComponents.hour = 12
    guard let endDate = calendar.date(from: endComponents) else {
      resolve(["hasData": false])
      return
    }

    let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
      guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
        resolve(["hasData": false, "date": dateString])
        return
      }

      var totalSleep: TimeInterval = 0
      var totalInBed: TimeInterval = 0
      var deepSleep: TimeInterval = 0
      var remSleep: TimeInterval = 0
      var coreSleep: TimeInterval = 0
      var bedTime: Date?
      var wakeTime: Date?

      for sample in samples {
        let duration = sample.endDate.timeIntervalSince(sample.startDate)

        if sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue {
          totalInBed += duration
          if bedTime == nil { bedTime = sample.startDate }
          wakeTime = sample.endDate
        } else {
          totalSleep += duration
          if #available(iOS 16.0, *) {
            switch sample.value {
            case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
              deepSleep += duration
            case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
              remSleep += duration
            case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
              coreSleep += duration
            default:
              break
            }
          }
        }
      }

      let efficiency = totalInBed > 0 ? (totalSleep / totalInBed) * 100 : 0

      var result: [String: Any] = [
        "date": dateString,
        "hasData": true,
        "sleepEfficiency": efficiency
      ]
      result["totalSleepHours"] = totalSleep / 3600.0
      result["totalInBedHours"] = totalInBed / 3600.0
      result["deepSleepHours"] = deepSleep / 3600.0
      result["remSleepHours"] = remSleep / 3600.0
      result["coreSleepHours"] = coreSleep / 3600.0
      result["bedTime"] = bedTime != nil ? self.dateFormatter.string(from: bedTime!) : NSNull()
      result["wakeTime"] = wakeTime != nil ? self.dateFormatter.string(from: wakeTime!) : NSNull()

      resolve(result)
    }

    healthStore.execute(query)
  }

  // MARK: - HRV

  @objc
  func getHRV(_ startDate: String,
              endDate: String,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let start = dateFormatter.date(from: startDate),
          let end = dateFormatter.date(from: endDate) else {
      resolve(["readings": []])
      return
    }

    let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

    let query = HKSampleQuery(sampleType: hrvType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
      guard let samples = samples as? [HKQuantitySample] else {
        resolve(["readings": []])
        return
      }

      let readings = samples.map { sample -> [String: Any] in
        return [
          "date": self.dateFormatter.string(from: sample.startDate),
          "hrvMs": sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli)),
          "source": sample.sourceRevision.source.name
        ]
      }

      resolve(["readings": readings])
    }

    healthStore.execute(query)
  }

  // MARK: - Resting Heart Rate

  @objc
  func getRestingHeartRate(_ startDate: String,
                           endDate: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let start = dateFormatter.date(from: startDate),
          let end = dateFormatter.date(from: endDate) else {
      resolve(["readings": []])
      return
    }

    let hrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate)!
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
    let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

    let query = HKSampleQuery(sampleType: hrType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sortDescriptor]) { _, samples, error in
      guard let samples = samples as? [HKQuantitySample] else {
        resolve(["readings": []])
        return
      }

      let readings = samples.map { sample -> [String: Any] in
        return [
          "date": self.dateFormatter.string(from: sample.startDate),
          "bpm": sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())),
          "source": sample.sourceRevision.source.name
        ]
      }

      resolve(["readings": readings])
    }

    healthStore.execute(query)
  }

  // MARK: - Steps

  @objc
  func getStepCount(_ dateString: String,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let date = dayFormatter.date(from: dateString) else {
      resolve(["steps": 0])
      return
    }

    let calendar = Calendar.current
    let startOfDay = calendar.startOfDay(for: date)
    guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
      resolve(["steps": 0])
      return
    }

    let stepsType = HKObjectType.quantityType(forIdentifier: .stepCount)!
    let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

    let query = HKStatisticsQuery(quantityType: stepsType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
      let steps = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
      resolve(["steps": Int(steps)])
    }

    healthStore.execute(query)
  }

  // MARK: - Today Summary

  @objc
  func getTodayHealthSummary(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    let today = Date()
    let dateString = dayFormatter.string(from: today)

    resolve([
      "date": dateString,
      "hasHealthKitAccess": HKHealthStore.isHealthDataAvailable()
    ])
  }
}
