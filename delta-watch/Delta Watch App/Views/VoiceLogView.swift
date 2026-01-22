import SwiftUI
import WatchKit

struct VoiceLogView: View {
    @EnvironmentObject var connectivityManager: WatchConnectivityManager

    @Environment(\.dismiss) private var dismiss

    @State private var transcribedText = ""
    @State private var isRecording = false
    @State private var isSending = false
    @State private var showingConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Microphone Icon
                    microphoneSection

                    // Transcribed Text
                    if !transcribedText.isEmpty {
                        transcribedTextSection
                    }

                    // Instructions
                    if transcribedText.isEmpty && !isRecording {
                        instructionsSection
                    }

                    // Actions
                    if !transcribedText.isEmpty {
                        actionsSection
                    }

                    // Error Message
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding()
            }
            .navigationTitle("Voice Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .alert("Sent!", isPresented: $showingConfirmation) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("Your note has been sent to Delta")
            }
        }
    }

    // MARK: - Microphone Section

    private var microphoneSection: some View {
        Button {
            startDictation()
        } label: {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red : Color.blue)
                    .frame(width: 70, height: 70)

                Image(systemName: isRecording ? "waveform" : "mic.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(.plain)
        .disabled(isSending)
    }

    // MARK: - Transcribed Text Section

    private var transcribedTextSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your note:")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(transcribedText)
                .font(.system(size: 14))
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.gray.opacity(0.2))
                .cornerRadius(8)
        }
    }

    // MARK: - Instructions Section

    private var instructionsSection: some View {
        VStack(spacing: 8) {
            Text("Tap the microphone to start")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text("Log meals, workouts, or any health notes")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Actions Section

    private var actionsSection: some View {
        VStack(spacing: 8) {
            Button {
                sendToiPhone()
            } label: {
                HStack {
                    if isSending {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text("Send to Delta")
                }
                .font(.system(size: 14, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .buttonStyle(.plain)
            .disabled(isSending)

            Button {
                transcribedText = ""
            } label: {
                Text("Clear")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .disabled(isSending)
        }
    }

    // MARK: - Actions

    private func startDictation() {
        isRecording = true
        errorMessage = nil

        WKExtension.shared().visibleInterfaceController?.presentTextInputController(
            withSuggestions: suggestedPhrases,
            allowedInputMode: .plain
        ) { results in
            isRecording = false

            if let results = results as? [String], let text = results.first {
                transcribedText = text
            }
        }
    }

    private func sendToiPhone() {
        guard !transcribedText.isEmpty else { return }

        isSending = true
        errorMessage = nil

        // Send to iPhone via Watch Connectivity
        connectivityManager.sendVoiceLog(text: transcribedText)

        // Haptic feedback
        WKInterfaceDevice.current().play(.success)

        // Show confirmation after a brief delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isSending = false
            showingConfirmation = true
        }
    }

    // MARK: - Suggested Phrases

    private var suggestedPhrases: [String] {
        [
            "Had a chicken salad for lunch",
            "Feeling energized today",
            "Slept well last night",
            "Skipped breakfast",
            "Post-workout protein shake"
        ]
    }
}

// MARK: - Voice Log Button for Home View

struct VoiceLogButton: View {
    @State private var showingVoiceLog = false

    var body: some View {
        Button {
            showingVoiceLog = true
        } label: {
            HStack {
                Image(systemName: "mic.fill")
                    .foregroundColor(.blue)
                Text("Voice Log")
                    .font(.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.blue.opacity(0.15))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingVoiceLog) {
            VoiceLogView()
        }
    }
}

#Preview {
    VoiceLogView()
        .environmentObject(WatchConnectivityManager.shared)
}
