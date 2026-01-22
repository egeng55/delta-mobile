import SwiftUI

struct WorkoutButton: View {
    enum ButtonStyle {
        case start
        case stop
        case pause
        case resume
    }

    let style: ButtonStyle
    let action: () -> Void
    let isLoading: Bool

    init(style: ButtonStyle, isLoading: Bool = false, action: @escaping () -> Void) {
        self.style = style
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: iconName)
                        .font(.system(size: 16, weight: .semibold))
                }

                Text(title)
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(backgroundColor)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private var title: String {
        switch style {
        case .start: return "Start Workout"
        case .stop: return "End Workout"
        case .pause: return "Pause"
        case .resume: return "Resume"
        }
    }

    private var iconName: String {
        switch style {
        case .start: return "play.fill"
        case .stop: return "stop.fill"
        case .pause: return "pause.fill"
        case .resume: return "play.fill"
        }
    }

    private var backgroundColor: Color {
        switch style {
        case .start: return .green
        case .stop: return .red
        case .pause: return .orange
        case .resume: return .green
        }
    }
}

// MARK: - Circular Workout Button

struct CircularWorkoutButton: View {
    enum ButtonType {
        case start
        case stop
    }

    let type: ButtonType
    let size: CGFloat
    let action: () -> Void

    init(type: ButtonType, size: CGFloat = 60, action: @escaping () -> Void) {
        self.type = type
        self.size = size
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(backgroundColor)
                    .frame(width: size, height: size)

                Image(systemName: iconName)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(.plain)
    }

    private var iconName: String {
        switch type {
        case .start: return "play.fill"
        case .stop: return "stop.fill"
        }
    }

    private var backgroundColor: Color {
        switch type {
        case .start: return .green
        case .stop: return .red
        }
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(color)

                Text(label)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(color.opacity(0.15))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    VStack(spacing: 16) {
        WorkoutButton(style: .start) {}
        WorkoutButton(style: .stop) {}
        WorkoutButton(style: .pause) {}
        WorkoutButton(style: .resume) {}
        WorkoutButton(style: .start, isLoading: true) {}

        HStack {
            CircularWorkoutButton(type: .start) {}
            CircularWorkoutButton(type: .stop) {}
        }

        HStack {
            QuickActionButton(icon: "mic.fill", label: "Voice", color: .blue) {}
            QuickActionButton(icon: "list.bullet", label: "Exercises", color: .purple) {}
        }
    }
    .padding()
}
