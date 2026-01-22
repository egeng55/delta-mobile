import SwiftUI
import HealthKit

@main
struct DeltaWatchApp: App {
    @StateObject private var connectivityManager = WatchConnectivityManager.shared
    @StateObject private var healthKitManager = HealthKitManager.shared
    @StateObject private var cacheManager = CacheManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectivityManager)
                .environmentObject(healthKitManager)
                .environmentObject(cacheManager)
                .onAppear {
                    setupApp()
                }
        }
    }

    private func setupApp() {
        // Request HealthKit authorization
        healthKitManager.requestAuthorization { success, error in
            if let error = error {
                print("HealthKit authorization failed: \(error.localizedDescription)")
            }
        }

        // Activate Watch Connectivity session
        connectivityManager.activateSession()

        // Request sync from iPhone if needed
        if cacheManager.shouldRequestSync() {
            connectivityManager.requestSync()
        }
    }
}
