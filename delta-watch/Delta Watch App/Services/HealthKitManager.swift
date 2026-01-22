import Foundation
import HealthKit
import Combine
import WatchKit

class HealthKitManager: NSObject, ObservableObject {
    static let shared = HealthKitManager()

    // MARK: - Published Properties

    @Published var isAuthorized = false
    @Published var currentHeartRate: Double?
    @Published var activeCalories: Double = 0
    @Published var elapsedTime: TimeInterval = 0
    @Published var isWorkoutActive = false

    // MARK: - Private Properties

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var heartRateQuery: HKAnchoredObjectQuery?
    private var workoutStartTime: Date?
    private var timer: Timer?

    // MARK: - HealthKit Types

    private let typesToRead: Set<HKSampleType> = [
        HKQuantityType(.heartRate),
        HKQuantityType(.activeEnergyBurned),
        HKQuantityType(.stepCount),
        HKWorkoutType.workoutType()
    ]

    private let typesToWrite: Set<HKSampleType> = [
        HKQuantityType(.activeEnergyBurned),
        HKWorkoutType.workoutType()
    ]

    // MARK: - Initialization

    private override init() {
        super.init()
    }

    // MARK: - Authorization

    func requestAuthorization(completion: @escaping (Bool, Error?) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false, HealthKitError.notAvailable)
            return
        }

        healthStore.requestAuthorization(toShare: typesToWrite, read: typesToRead) { [weak self] success, error in
            DispatchQueue.main.async {
                self?.isAuthorized = success
                completion(success, error)
            }
        }
    }

    // MARK: - Workout Session Management

    func startWorkout(activityType: HKWorkoutActivityType, completion: @escaping (Result<Void, Error>) -> Void) {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType
        configuration.locationType = .indoor

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = session?.associatedWorkoutBuilder()

            session?.delegate = self
            builder?.delegate = self

            builder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )

            let startDate = Date()
            session?.startActivity(with: startDate)

            builder?.beginCollection(withStart: startDate) { [weak self] success, error in
                DispatchQueue.main.async {
                    if success {
                        self?.workoutStartTime = startDate
                        self?.isWorkoutActive = true
                        self?.startHeartRateQuery()
                        self?.startTimer()
                        completion(.success(()))
                    } else {
                        completion(.failure(error ?? HealthKitError.workoutSessionFailed))
                    }
                }
            }
        } catch {
            completion(.failure(error))
        }
    }

    func pauseWorkout() {
        session?.pause()
    }

    func resumeWorkout() {
        session?.resume()
    }

    func endWorkout(completion: @escaping (Result<HKWorkout?, Error>) -> Void) {
        guard let session = session, let builder = builder else {
            completion(.failure(HealthKitError.workoutSessionFailed))
            return
        }

        session.end()

        builder.endCollection(withEnd: Date()) { [weak self] success, error in
            if !success {
                DispatchQueue.main.async {
                    completion(.failure(error ?? HealthKitError.workoutSessionFailed))
                }
                return
            }

            builder.finishWorkout { [weak self] workout, error in
                DispatchQueue.main.async {
                    self?.stopHeartRateQuery()
                    self?.stopTimer()
                    self?.isWorkoutActive = false
                    self?.session = nil
                    self?.builder = nil

                    if let error = error {
                        completion(.failure(error))
                    } else {
                        completion(.success(workout))
                    }
                }
            }
        }
    }

    // MARK: - Heart Rate Monitoring

    private func startHeartRateQuery() {
        let heartRateType = HKQuantityType(.heartRate)

        let query = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: nil,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] query, samples, deletedObjects, anchor, error in
            self?.processHeartRateSamples(samples)
        }

        query.updateHandler = { [weak self] query, samples, deletedObjects, anchor, error in
            self?.processHeartRateSamples(samples)
        }

        heartRateQuery = query
        healthStore.execute(query)
    }

    private func stopHeartRateQuery() {
        if let query = heartRateQuery {
            healthStore.stop(query)
            heartRateQuery = nil
        }
    }

    private func processHeartRateSamples(_ samples: [HKSample]?) {
        guard let samples = samples as? [HKQuantitySample], let lastSample = samples.last else {
            return
        }

        let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
        let heartRate = lastSample.quantity.doubleValue(for: heartRateUnit)

        DispatchQueue.main.async {
            self.currentHeartRate = heartRate
        }
    }

    // MARK: - Timer

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let startTime = self?.workoutStartTime else { return }
            DispatchQueue.main.async {
                self?.elapsedTime = Date().timeIntervalSince(startTime)
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Workout Data

    func getWorkoutSummary() -> SyncData {
        return .healthData(
            heartRate: currentHeartRate,
            calories: activeCalories,
            duration: elapsedTime
        )
    }

    func resetWorkoutData() {
        currentHeartRate = nil
        activeCalories = 0
        elapsedTime = 0
        workoutStartTime = nil
    }
}

// MARK: - HKWorkoutSessionDelegate

extension HealthKitManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        DispatchQueue.main.async {
            switch toState {
            case .running:
                self.isWorkoutActive = true
            case .paused:
                self.isWorkoutActive = false
            case .ended:
                self.isWorkoutActive = false
            default:
                break
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Workout session failed: \(error.localizedDescription)")
        DispatchQueue.main.async {
            self.isWorkoutActive = false
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension HealthKitManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle workout events if needed
    }

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }

            if quantityType == HKQuantityType(.activeEnergyBurned) {
                let statistics = workoutBuilder.statistics(for: quantityType)
                let value = statistics?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0

                DispatchQueue.main.async {
                    self.activeCalories = value
                }
            }
        }
    }
}
