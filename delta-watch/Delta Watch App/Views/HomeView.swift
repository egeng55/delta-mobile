import SwiftUI

struct HomeView: View {
    @EnvironmentObject var cacheManager: CacheManager
    @EnvironmentObject var healthKitManager: HealthKitManager
    @EnvironmentObject var connectivityManager: WatchConnectivityManager

    @State private var showingWorkout = false
    @State private var showingVoiceLog = false
    @State private var isStartingWorkout = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header
                headerSection

                // Wellness Score
                if let wellnessScore = cacheManager.cache.wellnessScore {
                    wellnessSection(score: wellnessScore)
                }

                // Today's Workout
                if let workout = cacheManager.cache.todayWorkout {
                    workoutSection(workout: workout)
                } else {
                    noWorkoutSection
                }

                // Quick Actions
                quickActionsSection
            }
            .padding()
        }
        .navigationTitle("Delta")
        .navigationDestination(isPresented: $showingWorkout) {
            if let workout = cacheManager.cache.todayWorkout {
                WorkoutView(workout: workout)
            }
        }
        .sheet(isPresented: $showingVoiceLog) {
            VoiceLogView()
        }
        .onReceive(NotificationCenter.default.publisher(for: .workoutDidStart)) { notification in
            if let workout = notification.object as? WatchWorkout {
                cacheManager.updateWorkout(workout)
                showingWorkout = true
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            Text("DELTA")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(.blue)

            Spacer()

            if !connectivityManager.isPhoneReachable {
                Image(systemName: "iphone.slash")
                    .font(.system(size: 12))
                    .foregroundColor(.orange)
            }
        }
    }

    // MARK: - Wellness Section

    private func wellnessSection(score: Int) -> some View {
        VStack(spacing: 8) {
            MetricRing(
                value: Double(score),
                maxValue: 100,
                label: "Wellness",
                color: wellnessColor(for: score),
                size: 100
            )
        }
    }

    private func wellnessColor(for score: Int) -> Color {
        switch score {
        case 80...100: return .green
        case 60..<80: return .yellow
        case 40..<60: return .orange
        default: return .red
        }
    }

    // MARK: - Workout Section

    private func workoutSection(workout: WatchWorkout) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Today's Workout")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(workout.name)
                .font(.headline)

            HStack {
                Image(systemName: "clock")
                    .font(.caption)
                Text("\(workout.estimatedDuration) min")
                    .font(.caption)

                Spacer()

                Text("\(workout.completedExercisesCount)/\(workout.exercises.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .foregroundColor(.secondary)

            if workout.status == .inProgress {
                WorkoutButton(style: .resume) {
                    showingWorkout = true
                }
            } else if workout.status == .completed {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Completed")
                        .font(.subheadline)
                        .foregroundColor(.green)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            } else {
                WorkoutButton(style: .start, isLoading: isStartingWorkout) {
                    startWorkout(workout)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.2))
        .cornerRadius(12)
    }

    private var noWorkoutSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 32))
                .foregroundColor(.secondary)

            Text("No workout scheduled")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text("Check the Delta app")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.gray.opacity(0.2))
        .cornerRadius(12)
    }

    // MARK: - Quick Actions Section

    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            QuickActionButton(
                icon: "mic.fill",
                label: "Voice Log",
                color: .blue
            ) {
                showingVoiceLog = true
            }

            if cacheManager.cache.todayWorkout != nil {
                QuickActionButton(
                    icon: "list.bullet",
                    label: "Exercises",
                    color: .purple
                ) {
                    showingWorkout = true
                }
            }
        }
    }

    // MARK: - Actions

    private func startWorkout(_ workout: WatchWorkout) {
        isStartingWorkout = true

        // Update local cache
        cacheManager.updateWorkoutStatus(.inProgress)

        // Notify iPhone
        connectivityManager.sendWorkoutStarted(workoutId: workout.id)

        // Start HealthKit workout session
        healthKitManager.startWorkout(activityType: workout.healthKitActivityType) { result in
            DispatchQueue.main.async {
                isStartingWorkout = false

                switch result {
                case .success:
                    showingWorkout = true
                case .failure(let error):
                    print("Failed to start workout: \(error.localizedDescription)")
                    // Still show workout view even if HealthKit fails
                    showingWorkout = true
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        HomeView()
            .environmentObject(CacheManager.shared)
            .environmentObject(HealthKitManager.shared)
            .environmentObject(WatchConnectivityManager.shared)
    }
}
