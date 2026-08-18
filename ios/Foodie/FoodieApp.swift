import SwiftUI

@main
struct FoodieApp: App {
    @StateObject private var store = FoodStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .tint(store.theme.accent)
                .preferredColorScheme(store.theme.colorScheme)
        }
    }
}
