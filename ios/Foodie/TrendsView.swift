import SwiftUI
import Charts

/// Two graphical trackers: body weight over time, and how consistently daily
/// calories land at or under the goal.
struct TrendsView: View {
    @EnvironmentObject var store: FoodStore
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .weight

    private enum Tab: String, CaseIterable, Identifiable {
        case weight = "Weight", calories = "Calories"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("View", selection: $tab) {
                    ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding([.horizontal, .top], 16)

                ScrollView {
                    Group {
                        switch tab {
                        case .weight: WeightTrendCard()
                        case .calories: CalorieTrendCard()
                        }
                    }
                    .padding(16)
                }
            }
            .background(store.theme.background)
            .navigationTitle("Trends")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Weight

private enum WeightRange: Int, CaseIterable, Identifiable {
    case d30 = 30, d90 = 90, d365 = 365, all = 0
    var id: Int { rawValue }
    var label: String {
        switch self {
        case .d30: return "30d"
        case .d90: return "90d"
        case .d365: return "1y"
        case .all: return "All"
        }
    }
}

private struct WeightTrendCard: View {
    @EnvironmentObject var store: FoodStore
    @State private var range: WeightRange = .d90
    @State private var inputText = ""

    private var allEntries: [WeightEntry] { store.weightHistory() }

    private var visibleEntries: [WeightEntry] {
        guard range != .all else { return allEntries }
        let cutoff = Calendar.current.date(byAdding: .day, value: -range.rawValue, to: Date()) ?? .distantPast
        return allEntries.filter { $0.date >= cutoff }
    }

    private var unit: WeightUnit { store.weightUnit }
    private func displayValue(_ kg: Double) -> Double { unit.value(fromKg: kg) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            logRow
            Divider()
            if allEntries.isEmpty {
                Text("No weight logged yet. Enter today's weight above to start your trend.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                rangePicker
                chart
                stats
            }
        }
        .padding(16)
        .background(store.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .onAppear { prefillInput() }
    }

    private var logRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Log today's weight").font(.headline)
                Spacer()
                Picker("Unit", selection: $store.weightUnit) {
                    ForEach(WeightUnit.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 110)
                .onChange(of: store.weightUnit) { _, _ in prefillInput() }
            }
            HStack(spacing: 10) {
                TextField(unit.label, text: $inputText)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                Button("Log") { logWeight() }
                    .buttonStyle(.borderedProminent)
                    .tint(store.theme.accent)
                    .foregroundStyle(store.theme.onAccent)
                    .disabled(parsedInput == nil)
            }
        }
    }

    private var parsedInput: Double? {
        Double(inputText.replacingOccurrences(of: ",", with: "."))
    }

    private func logWeight() {
        guard let v = parsedInput else { return }
        store.logWeight(v, unit: unit, for: Date())
    }

    private func prefillInput() {
        if let kg = store.weightKg(for: Date()) {
            inputText = formatted(displayValue(kg))
        }
    }

    private var rangePicker: some View {
        Picker("Range", selection: $range) {
            ForEach(WeightRange.allCases) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
    }

    private var chart: some View {
        Chart(visibleEntries) { entry in
            LineMark(
                x: .value("Date", entry.date, unit: .day),
                y: .value("Weight", displayValue(entry.kg))
            )
            .interpolationMethod(.catmullRom)
            .foregroundStyle(store.theme.accent)

            PointMark(
                x: .value("Date", entry.date, unit: .day),
                y: .value("Weight", displayValue(entry.kg))
            )
            .foregroundStyle(store.theme.accent)
            .symbolSize(18)
        }
        .chartYAxisLabel(unit.label)
        .frame(height: 180)
        .padding(.top, 4)
    }

    private var stats: some View {
        let values = visibleEntries.map(\.kg)
        let latest = values.last.map(displayValue)
        let first = values.first.map(displayValue)
        let change = (latest != nil && first != nil) ? latest! - first! : nil

        return HStack(spacing: 0) {
            statColumn(title: "Current", value: latest.map { "\(formatted($0)) \(unit.label)" } ?? "—")
            Divider().frame(height: 34)
            statColumn(title: "Change (\(range.label.lowercased()))",
                       value: change.map(changeText) ?? "—",
                       color: (change ?? 0) <= 0 ? store.theme.accent : .red)
        }
        .padding(.top, 4)
    }

    private func statColumn(title: String, value: String, color: Color = .primary) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.weight(.bold)).foregroundStyle(color).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func changeText(_ delta: Double) -> String {
        let sign = delta > 0 ? "+" : ""
        return "\(sign)\(formatted(delta)) \(unit.label)"
    }

    private func formatted(_ v: Double) -> String { String(format: "%.1f", v) }
}

// MARK: - Calories

private enum CalorieRange: Int, CaseIterable, Identifiable {
    case d7 = 7, d14 = 14, d30 = 30, d90 = 90
    var id: Int { rawValue }
    var label: String { "\(rawValue)d" }
}

private struct CalorieTrendCard: View {
    @EnvironmentObject var store: FoodStore
    @State private var range: CalorieRange = .d14

    private var data: [(date: Date, kcal: Int)] { store.dailyKcalTotals(lastDays: range.rawValue) }
    private var loggedDays: [(date: Date, kcal: Int)] { data.filter { $0.kcal > 0 } }
    private var onGoalCount: Int { loggedDays.filter { $0.kcal <= store.goal }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Calorie consistency").font(.headline)

            Picker("Range", selection: $range) {
                ForEach(CalorieRange.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            if loggedDays.isEmpty {
                Text("Log a few days of food to see your consistency here.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                chart
                Text("\(onGoalCount) of \(loggedDays.count) logged \(loggedDays.count == 1 ? "day" : "days") at or under goal")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(store.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var chart: some View {
        Chart {
            ForEach(data, id: \.date) { point in
                BarMark(
                    x: .value("Date", point.date, unit: .day),
                    y: .value("Calories", point.kcal)
                )
                .foregroundStyle(barColor(point.kcal))
            }
            RuleMark(y: .value("Goal", store.goal))
                .foregroundStyle(.secondary)
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(position: .top, alignment: .trailing) {
                    Text("Goal").font(.caption2).foregroundStyle(.secondary)
                }
        }
        .frame(height: 180)
        .padding(.top, 4)
    }

    private func barColor(_ kcal: Int) -> Color {
        if kcal == 0 { return Color(.systemGray4) }
        return kcal <= store.goal ? store.theme.accent : .red
    }
}

#Preview {
    TrendsView().environmentObject(FoodStore(fileURL:
        FileManager.default.temporaryDirectory.appendingPathComponent("preview-trends.json")))
}
