import Foundation

/// A single logged food item.
struct FoodEntry: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var name: String
    var kcal: Int
    var protein: Int = 0
    var carbs: Int = 0
    var fat: Int = 0

    /// A compact "P 20 · C 30 · F 5 g" macro line, or nil when no macros were set.
    var macroSummary: String? {
        var parts: [String] = []
        if protein > 0 { parts.append("P \(protein)") }
        if carbs > 0 { parts.append("C \(carbs)") }
        if fat > 0 { parts.append("F \(fat)") }
        return parts.isEmpty ? nil : parts.joined(separator: "  ·  ") + " g"
    }
}

/// Sum of calories and macros for a day.
struct Totals: Equatable {
    var kcal = 0
    var protein = 0
    var carbs = 0
    var fat = 0
}

/// Codable snapshot used for persistence and for JSON export/import.
/// Keeps the same shape as the web version so backups are interchangeable.
struct Snapshot: Codable {
    var goal: Int
    var days: [String: [FoodEntry]]
    var recents: [FoodEntry]

    static let empty = Snapshot(goal: 2000, days: [:], recents: [])
}
