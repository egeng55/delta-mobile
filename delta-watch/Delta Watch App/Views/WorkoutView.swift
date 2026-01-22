import SwiftUI
import WatchKit

struct WorkoutView: View {
    @EnvironmentObject var healthKitManager: HealthKitManager
    @EnvironmentObject var cacheManager: CacheManager
    @EnvironmentObject var connectivityManager: WatchConnectivityManager

    @Environment(\.dismiss) private var dismiss

    let workout: WatchWorkout

    @State private var showingExerciseList = false
    @State private var showingEndConfirmation = false
    @State private var isEndingWorkout = false

    private var currentExercise: WatchExercise? {
        cacheManager.cache.todayWorkout?.exercises.first { !$0.isCompleted }
    }

    private var currentWorkout: WatchWorkout {
        cacheManager.cache.todayWorkout ?? workout
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Workout Header
                headerSection

                // Progress Bar
                progressSection

                // Metrics
                metricsSection

                // Current Exercise
                if let exercise = currentExercise {
                    currentExerciseSection(exercise: exercise)
                } else {
                    workoutCompleteSection
                }

                // Actions
                actionsSection
            }
            .padding()
        }
        .navigationTitle(currentWorkout.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $showingExerciseList) {
            ExerciseListView(exercises: currentWorkout.exercises)
        }
        .confirmationDialog(
            "End Workout?",
            isPresented: $showingEndConfirmation,
            titleVisibility: .visible
        ) {
            Button("End Workout", role: .destructive) {
                endWorkout()
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            Text(currentWorkout.name.uppercased())
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.secondary)

            Spacer()

            if healthKitManager.isWorkoutActive {
                Circle()
                    .fill(.green)
                    .frame(width: 8, height: 8)
            }
        }
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(spacing: 4) {
            WorkoutProgressBar(progress: currentWorkout.progress, color: .blue)

            HStack {
                Text("\(Int(currentWorkout.progress * 100))%")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text("\(currentWorkout.completedExercisesCount)/\(currentWorkout.exercises.count)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Metrics Section

    private var metricsSection: some View {
        VStack(spacing: 12) {
            HeartRateRing(heartRate: healthKitManager.currentHeartRate)

            HStack(spacing: 20) {
                CaloriesDisplay(calories: healthKitManager.activeCalories, size: 40)
                TimerDisplay(elapsedTime: healthKitManager.elapsedTime, size: 40)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.15))
        .cornerRadius(12)
    }

    // MARK: - Current Exercise Section

    private func currentExerciseSection(exercise: WatchExercise) -> some View {
        CurrentExerciseCard(exercise: exercise) {
            completeExercise(exercise)
        }
    }

    private var workoutCompleteSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundColor(.green)

            Text("All exercises complete!")
                .font(.headline)

            Text("End your workout to save")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.gray.opacity(0.15))
        .cornerRadius(12)
    }

    // MARK: - Actions Section

    private var actionsSection: some View {
        VStack(spacing: 8) {
            Button {
                showingExerciseList = true
            } label: {
                Label("View All Exercises", systemImage: "list.bullet")
                    .font(.system(size: 14))
            }
            .buttonStyle(.bordered)

            WorkoutButton(style: .stop, isLoading: isEndingWorkout) {
                showingEndConfirmation = true
            }
        }
    }

    // MARK: - Actions

    private func completeExercise(_ exercise: WatchExercise) {
        // Haptic feedback
        WKInterfaceDevice.current().play(.success)

        // Update local cache
        cacheManager.markExerciseCompleted(exerciseId: exercise.id)

        // Sync to iPhone
        connectivityManager.sendExerciseCompleted(
            exerciseId: exercise.id,
            workoutId: currentWorkout.id
        )
    }

    private func endWorkout() {
        isEndingWorkout = true

        // Get health data summary
        let healthData = healthKitManager.getWorkoutSummary()

        // End HealthKit session
        healthKitManager.endWorkout { result in
            DispatchQueue.main.async {
                isEndingWorkout = false

                // Update local cache
                cacheManager.updateWorkoutStatus(.completed)

                // Sync to iPhone
                connectivityManager.sendWorkoutEnded(
                    workoutId: currentWorkout.id,
                    healthData: healthData
                )

                // Reset health data
                healthKitManager.resetWorkoutData()

                // Dismiss view
                dismiss()
            }
        }
    }
}

#Preview {
    let workout = WatchWorkout(
        id: "1",
        name: "Upper Body",
        exercises: [
            WatchExercise(id: "1", name: "Bench Press", sets: 3, reps: 10, weight: 135, weightUnit: "lb", isCompleted: true),
            WatchExercise(id: "2", name: "Incline DB Press", sets: 3, reps: 12, weight: 50, weightUnit: "lb", isCompleted: true),
            WatchExercise(id: "3", name: "Cable Flyes", sets: 3, reps: 15, weight: 30, weightUnit: "lb", isCompleted: false),
            WatchExercise(id: "4", name: "Tricep Pushdown", sets: 3, reps: 12, weight: 40, weightUnit: "lb", isCompleted: false),
        ],
        estimatedDuration: 45,
        status: .inProgress,
        startedAt: Date()
    )

    NavigationStack {
        WorkoutView(workout: workout)
            .environmentObject(HealthKitManager.shared)
            .environmentObject(CacheManager.shared)
            .environmentObject(WatchConnectivityManager.shared)
    }
}
