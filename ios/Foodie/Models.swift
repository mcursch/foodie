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

/// Body-weight display unit. Entries are always stored canonically in kg so
/// switching units later doesn't rewrite history.
enum WeightUnit: String, Codable, CaseIterable, Identifiable {
    case lb, kg
    var id: String { rawValue }
    var label: String { self == .lb ? "lb" : "kg" }

    private static let kgPerLb = 0.45359237

    func value(fromKg kg: Double) -> Double {
        self == .lb ? kg / Self.kgPerLb : kg
    }
    func kg(fromValue value: Double) -> Double {
        self == .lb ? value * Self.kgPerLb : value
    }
}

/// A single day's body-weight reading (one per day; a re-log overwrites it).
struct WeightEntry: Identifiable, Hashable {
    var date: Date
    var kg: Double
    var id: Date { date }
}

/// Codable snapshot used for persistence and for JSON export/import.
/// Keeps the same shape as the web version so backups are interchangeable.
struct Snapshot: Codable {
    var goal: Int
    var days: [String: [FoodEntry]]
    var recents: [FoodEntry]
    var weights: [String: Double]      // day key -> kg
    var weightUnit: WeightUnit
    var theme: AppTheme

    static let empty = Snapshot(goal: 2000, days: [:], recents: [], weights: [:], weightUnit: .lb, theme: .auto)

    init(goal: Int, days: [String: [FoodEntry]], recents: [FoodEntry],
         weights: [String: Double] = [:], weightUnit: WeightUnit = .lb, theme: AppTheme = .auto) {
        self.goal = goal
        self.days = days
        self.recents = recents
        self.weights = weights
        self.weightUnit = weightUnit
        self.theme = theme
    }

    // Custom decoding so backups made before weight tracking / theming (missing
    // these keys) still load instead of failing the whole snapshot.
    enum CodingKeys: String, CodingKey { case goal, days, recents, weights, weightUnit, theme }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        goal = try c.decode(Int.self, forKey: .goal)
        days = try c.decode([String: [FoodEntry]].self, forKey: .days)
        recents = try c.decode([FoodEntry].self, forKey: .recents)
        weights = try c.decodeIfPresent([String: Double].self, forKey: .weights) ?? [:]
        weightUnit = try c.decodeIfPresent(WeightUnit.self, forKey: .weightUnit) ?? .lb
        theme = try c.decodeIfPresent(AppTheme.self, forKey: .theme) ?? .auto
    }
}
