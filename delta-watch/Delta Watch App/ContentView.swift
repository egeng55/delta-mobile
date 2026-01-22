import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connectivityManager: WatchConnectivityManager
    @EnvironmentObject var cacheManager: CacheManager

    var body: some View {
        NavigationStack {
            if cacheManager.cache.isAuthenticated {
                HomeView()
            } else {
                NotAuthenticatedView()
            }
        }
    }
}

struct NotAuthenticatedView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "iphone.and.arrow.forward")
                .font(.system(size: 40))
                .foregroundColor(.blue)

            Text("Open Delta")
                .font(.headline)

            Text("Sign in on your iPhone to use Delta on Apple Watch")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchConnectivityManager.shared)
        .environmentObject(CacheManager.shared)
}
