import Foundation
import Combine

/// The app's single source of truth. Holds all data in memory and persists it
/// as JSON in the app's Documents directory. No network, no account — 100% local.
final class FoodStore: ObservableObject {
    @Published var goal: Int
    @Published private(set) var days: [String: [FoodEntry]]
    @Published private(set) var recents: [FoodEntry]
    @Published private(set) var weights: [String: Double]   // day key -> kg
    @Published var weightUnit: WeightUnit
    @Published var theme: AppTheme

    private let fileURL: URL
    private var saveCancellable: AnyCancellable?

    // MARK: - Init / persistence

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? FoodStore.defaultFileURL()
        let snapshot = FoodStore.load(from: self.fileURL)
        self.goal = snapshot.goal
        self.days = snapshot.days
        self.recents = snapshot.recents
        self.weights = snapshot.weights
        self.weightUnit = snapshot.weightUnit
        self.theme = snapshot.theme

        // Debounced auto-save whenever anything changes.
        saveCancellable = objectWillChange
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.save() }
    }

    private static func defaultFileURL() -> URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("foodie.json")
    }

    private static func load(from url: URL) -> Snapshot {
        guard let data = try? Data(contentsOf: url),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data)
        else { return .empty }
        return snap
    }

    func save() {
        let snapshot = Snapshot(goal: goal, days: days, recents: recents,
                                 weights: weights, weightUnit: weightUnit, theme: theme)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }

    // MARK: - Date keys

    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    func key(for date: Date) -> String { Self.dayFormatter.string(from: date) }

    // MARK: - Reads

    func entries(for date: Date) -> [FoodEntry] { days[key(for: date)] ?? [] }

    func totals(for date: Date) -> Totals {
        entries(for: date).reduce(into: Totals()) { acc, e in
            acc.kcal += e.kcal
            acc.protein += e.protein
            acc.carbs += e.carbs
            acc.fat += e.fat
        }
    }

    // MARK: - Mutations

    func add(_ entry: FoodEntry, to date: Date) {
        // Always mint a fresh id so re-adding a "recent" can't collide with an
        // existing logged row (which would break the list and delete-by-id).
        let clean = FoodEntry(
            id: UUID(),
            name: String(entry.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60)),
            kcal: max(0, entry.kcal),
            protein: max(0, entry.protein),
            carbs: max(0, entry.carbs),
            fat: max(0, entry.fat)
        )
        guard !clean.name.isEmpty, clean.kcal > 0 else { return }
        days[key(for: date), default: []].append(clean)
        rememberRecent(clean)
    }

    func delete(_ entry: FoodEntry, from date: Date) {
        let k = key(for: date)
        days[k]?.removeAll { $0.id == entry.id }
        if days[k]?.isEmpty == true { days[k] = nil }
    }

    func delete(at offsets: IndexSet, sorted entries: [FoodEntry], from date: Date) {
        for i in offsets { delete(entries[i], from: date) }
    }

    // MARK: - Weight

    func weightKg(for date: Date) -> Double? { weights[key(for: date)] }

    /// Logs (or overwrites) the day's weight. `value` is in `unit`, converted
    /// and stored canonically in kg.
    func logWeight(_ value: Double, unit: WeightUnit, for date: Date) {
        let kg = unit.kg(fromValue: value)
        guard kg > 0, kg < 700 else { return }
        weights[key(for: date)] = kg
    }

    func deleteWeight(for date: Date) {
        weights[key(for: date)] = nil
    }

    /// All logged weights, oldest first, as concrete dates for charting.
    func weightHistory() -> [WeightEntry] {
        weights.compactMap { key, kg in
            Self.dayFormatter.date(from: key).map { WeightEntry(date: $0, kg: kg) }
        }.sorted { $0.date < $1.date }
    }

    // MARK: - Calorie history

    /// Daily kcal totals for the trailing `count` days (including `end`), oldest
    /// first. Days with no entries come back as 0, so the chart shows real gaps.
    func dailyKcalTotals(lastDays count: Int, endingOn end: Date = Date()) -> [(date: Date, kcal: Int)] {
        let cal = Calendar.current
        let startOfEnd = cal.startOfDay(for: end)
        return (0..<count).reversed().compactMap { offset -> (Date, Int)? in
            guard let d = cal.date(byAdding: .day, value: -offset, to: startOfEnd) else { return nil }
            return (d, totals(for: d).kcal)
        }
    }

    private func rememberRecent(_ entry: FoodEntry) {
        let lower = entry.name.lowercased()
        recents.removeAll { $0.name.lowercased() == lower }
        // store a fresh id-less template by copying fields
        recents.insert(FoodEntry(name: entry.name, kcal: entry.kcal,
                                 protein: entry.protein, carbs: entry.carbs, fat: entry.fat),
                       at: 0)
        if recents.count > 12 { recents = Array(recents.prefix(12)) }
    }

    // MARK: - Import / export

    func exportData() -> Data {
        let snapshot = Snapshot(goal: goal, days: days, recents: recents,
                                 weights: weights, weightUnit: weightUnit, theme: theme)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? encoder.encode(snapshot)) ?? Data()
    }

    @discardableResult
    func importData(_ data: Data) -> Bool {
        guard let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return false }
        goal = min(max(snap.goal, 500), 10000)
        days = snap.days
        recents = snap.recents
        weights = snap.weights
        weightUnit = snap.weightUnit
        theme = snap.theme
        save()
        return true
    }
}
