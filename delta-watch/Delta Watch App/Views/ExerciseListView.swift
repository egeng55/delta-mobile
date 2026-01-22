import SwiftUI
import WatchKit

struct ExerciseListView: View {
    @EnvironmentObject var cacheManager: CacheManager
    @EnvironmentObject var connectivityManager: WatchConnectivityManager

    let exercises: [WatchExercise]

    @State private var scrollToId: String?

    private var currentExercises: [WatchExercise] {
        cacheManager.cache.todayWorkout?.exercises ?? exercises
    }

    private var currentExerciseId: String? {
        currentExercises.first { !$0.isCompleted }?.id
    }

    private var completedCount: Int {
        currentExercises.filter { $0.isCompleted }.count
    }

    var body: some View {
        ScrollViewReader { proxy in
            List {
                Section {
                    ForEach(currentExercises) { exercise in
                        ExerciseRow(
                            exercise: exercise,
                            isCurrent: exercise.id == currentExerciseId
                        ) {
                            completeExercise(exercise)
                        }
                        .id(exercise.id)
                    }
                } header: {
                    ExerciseListHeader(
                        completedCount: completedCount,
                        totalCount: currentExercises.count
                    )
                }
            }
            .listStyle(.carousel)
            .onAppear {
                // Scroll to current exercise
                if let currentId = currentExerciseId {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        withAnimation {
                            proxy.scrollTo(currentId, anchor: .center)
                        }
                    }
                }
            }
            .onChange(of: currentExerciseId) { _, newId in
                // Auto-scroll when exercise is completed
                if let newId = newId {
                    withAnimation {
                        proxy.scrollTo(newId, anchor: .center)
                    }
                }
            }
        }
        .navigationTitle("Exercises")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func completeExercise(_ exercise: WatchExercise) {
        // Haptic feedback
        WKInterfaceDevice.current().play(.success)

        // Update local cache
        cacheManager.markExerciseCompleted(exerciseId: exercise.id)

        // Sync to iPhone
        if let workoutId = cacheManager.cache.todayWorkout?.id {
            connectivityManager.sendExerciseCompleted(
                exerciseId: exercise.id,
                workoutId: workoutId
            )
        }
    }
}

// MARK: - Exercise Detail View

struct ExerciseDetailView: View {
    let exercise: WatchExercise
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Exercise Name
                Text(exercise.name)
                    .font(.headline)
                    .multilineTextAlignment(.center)

                // Sets x Reps
                HStack(spacing: 20) {
                    VStack {
                        Text("\(exercise.sets)")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                        Text("Sets")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text("x")
                        .font(.title2)
                        .foregroundColor(.secondary)

                    VStack {
                        Text("\(exercise.reps)")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                        Text("Reps")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Weight
                if let weight = exercise.weight, let unit = exercise.weightUnit {
                    VStack {
                        Text("\(Int(weight))")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                        Text(unit)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(12)
                }

                // Complete Button
                if !exercise.isCompleted {
                    Button {
                        onComplete()
                        dismiss()
                    } label: {
                        Label("Mark Complete", systemImage: "checkmark")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                } else {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Completed")
                            .foregroundColor(.green)
                    }
                    .font(.subheadline)
                }
            }
            .padding()
        }
        .navigationTitle("Exercise")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    let exercises = [
        WatchExercise(id: "1", name: "Bench Press", sets: 3, reps: 10, weight: 135, weightUnit: "lb", isCompleted: true),
        WatchExercise(id: "2", name: "Incline DB Press", sets: 3, reps: 12, weight: 50, weightUnit: "lb", isCompleted: true),
        WatchExercise(id: "3", name: "Cable Flyes", sets: 3, reps: 15, weight: 30, weightUnit: "lb", isCompleted: false),
        WatchExercise(id: "4", name: "Tricep Pushdown", sets: 3, reps: 12, weight: 40, weightUnit: "lb", isCompleted: false),
        WatchExercise(id: "5", name: "Overhead Extension", sets: 3, reps: 12, weight: 25, weightUnit: "lb", isCompleted: false),
        WatchExercise(id: "6", name: "Dips", sets: 3, reps: 10, weight: nil, weightUnit: nil, isCompleted: false),
        WatchExercise(id: "7", name: "Face Pulls", sets: 3, reps: 15, weight: 20, weightUnit: "lb", isCompleted: false),
    ]

    NavigationStack {
        ExerciseListView(exercises: exercises)
            .environmentObject(CacheManager.shared)
            .environmentObject(WatchConnectivityManager.shared)
    }
}
