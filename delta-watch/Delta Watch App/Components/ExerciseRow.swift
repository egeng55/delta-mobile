import SwiftUI

struct ExerciseRow: View {
    let exercise: WatchExercise
    let isCurrent: Bool
    let onComplete: () -> Void

    var body: some View {
        Button(action: onComplete) {
            HStack(spacing: 12) {
                // Completion indicator
                completionIndicator

                // Exercise info
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name)
                        .font(.system(size: 14, weight: isCurrent ? .semibold : .regular))
                        .foregroundColor(exercise.isCompleted ? .secondary : .primary)
                        .lineLimit(1)

                    HStack(spacing: 4) {
                        Text(exercise.setRepDisplay)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)

                        if let weight = exercise.displayWeight {
                            Text("@")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Text(weight)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(exercise.isCompleted)
    }

    @ViewBuilder
    private var completionIndicator: some View {
        ZStack {
            Circle()
                .stroke(indicatorColor.opacity(0.3), lineWidth: 2)
                .frame(width: 24, height: 24)

            if exercise.isCompleted {
                Circle()
                    .fill(indicatorColor)
                    .frame(width: 24, height: 24)
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    )
            } else if isCurrent {
                Circle()
                    .fill(indicatorColor)
                    .frame(width: 12, height: 12)
            }
        }
    }

    private var indicatorColor: Color {
        if exercise.isCompleted {
            return .green
        } else if isCurrent {
            return .blue
        } else {
            return .gray
        }
    }
}

// MARK: - Exercise List Header

struct ExerciseListHeader: View {
    let completedCount: Int
    let totalCount: Int

    var body: some View {
        HStack {
            Text("Exercises")
                .font(.headline)

            Spacer()

            Text("\(completedCount)/\(totalCount)")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
    }
}

// MARK: - Current Exercise Card

struct CurrentExerciseCard: View {
    let exercise: WatchExercise
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text("Current")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(exercise.name)
                .font(.headline)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            HStack(spacing: 12) {
                VStack {
                    Text("\(exercise.sets)")
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("sets")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Text("x")
                    .foregroundColor(.secondary)

                VStack {
                    Text("\(exercise.reps)")
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("reps")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if let weight = exercise.displayWeight {
                    Text("@")
                        .foregroundColor(.secondary)

                    VStack {
                        Text(weight)
                            .font(.title3)
                            .fontWeight(.bold)
                        Text("weight")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Button(action: onComplete) {
                Label("Complete Set", systemImage: "checkmark")
                    .font(.system(size: 14, weight: .semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
        }
        .padding()
        .background(Color.gray.opacity(0.2))
        .cornerRadius(12)
    }
}

#Preview {
    let exercise = WatchExercise(
        id: "1",
        name: "Bench Press",
        sets: 3,
        reps: 10,
        weight: 135,
        weightUnit: "lb",
        isCompleted: false
    )

    let completedExercise = WatchExercise(
        id: "2",
        name: "Incline DB Press",
        sets: 3,
        reps: 12,
        weight: 50,
        weightUnit: "lb",
        isCompleted: true
    )

    ScrollView {
        VStack(spacing: 12) {
            ExerciseListHeader(completedCount: 2, totalCount: 7)

            ExerciseRow(exercise: completedExercise, isCurrent: false) {}
            ExerciseRow(exercise: exercise, isCurrent: true) {}

            CurrentExerciseCard(exercise: exercise) {}
        }
        .padding()
    }
}
