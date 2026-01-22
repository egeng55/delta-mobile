import SwiftUI

struct MetricRing: View {
    let value: Double
    let maxValue: Double
    let label: String
    let color: Color
    let icon: String?
    let size: CGFloat

    init(
        value: Double,
        maxValue: Double = 100,
        label: String,
        color: Color = .blue,
        icon: String? = nil,
        size: CGFloat = 80
    ) {
        self.value = value
        self.maxValue = maxValue
        self.label = label
        self.color = color
        self.icon = icon
        self.size = size
    }

    private var progress: Double {
        min(value / maxValue, 1.0)
    }

    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(color.opacity(0.2), lineWidth: size * 0.1)

            // Progress circle
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    color,
                    style: StrokeStyle(
                        lineWidth: size * 0.1,
                        lineCap: .round
                    )
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.3), value: progress)

            // Center content
            VStack(spacing: 2) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: size * 0.15))
                        .foregroundColor(color)
                }

                Text("\(Int(value))")
                    .font(.system(size: size * 0.25, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)

                Text(label)
                    .font(.system(size: size * 0.1))
                    .foregroundColor(.secondary)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Heart Rate Ring

struct HeartRateRing: View {
    let heartRate: Double?
    let size: CGFloat

    init(heartRate: Double?, size: CGFloat = 60) {
        self.heartRate = heartRate
        self.size = size
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "heart.fill")
                .foregroundColor(.red)
                .font(.system(size: size * 0.3))

            if let hr = heartRate {
                Text("\(Int(hr))")
                    .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                Text("BPM")
                    .font(.system(size: size * 0.15))
                    .foregroundColor(.secondary)
            } else {
                Text("--")
                    .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Calories Display

struct CaloriesDisplay: View {
    let calories: Double
    let size: CGFloat

    init(calories: Double, size: CGFloat = 60) {
        self.calories = calories
        self.size = size
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "flame.fill")
                .foregroundColor(.orange)
                .font(.system(size: size * 0.3))

            Text("\(Int(calories))")
                .font(.system(size: size * 0.4, weight: .bold, design: .rounded))

            Text("cal")
                .font(.system(size: size * 0.15))
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Timer Display

struct TimerDisplay: View {
    let elapsedTime: TimeInterval
    let size: CGFloat

    init(elapsedTime: TimeInterval, size: CGFloat = 60) {
        self.elapsedTime = elapsedTime
        self.size = size
    }

    private var formattedTime: String {
        let hours = Int(elapsedTime) / 3600
        let minutes = Int(elapsedTime) / 60 % 60
        let seconds = Int(elapsedTime) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "timer")
                .foregroundColor(.green)
                .font(.system(size: size * 0.3))

            Text(formattedTime)
                .font(.system(size: size * 0.4, weight: .bold, design: .monospaced))
        }
    }
}

// MARK: - Progress Bar

struct WorkoutProgressBar: View {
    let progress: Double
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(color.opacity(0.2))

                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: geometry.size.width * min(progress, 1.0))
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 8)
    }
}

#Preview {
    VStack(spacing: 20) {
        MetricRing(
            value: 78,
            label: "Wellness",
            color: .green,
            icon: "heart.fill"
        )

        HeartRateRing(heartRate: 142)

        CaloriesDisplay(calories: 234)

        TimerDisplay(elapsedTime: 1092)

        WorkoutProgressBar(progress: 0.6, color: .blue)
            .padding(.horizontal)
    }
}
