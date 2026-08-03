import SwiftUI

@main
struct FoodieApp: App {
    @StateObject private var store = FoodStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .tint(.brandGreen)
        }
    }
}

extension Color {
    /// App accent — matches the icon. Also defined in Assets as AccentColor.
    static let brandGreen = Color(red: 0.13, green: 0.77, blue: 0.37)
    static let brandGreenDeep = Color(red: 0.08, green: 0.50, blue: 0.24)
}
