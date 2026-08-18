import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: FoodStore
    @State private var selectedDate = Date()
    @State private var showingSettings = false
    @State private var showingTrends = false

    private var isToday: Bool {
        Calendar.current.isDateInToday(selectedDate)
    }

    private var entries: [FoodEntry] { store.entries(for: selectedDate) }
    private var totals: Totals { store.totals(for: selectedDate) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    summaryCard
                    AddFoodView(date: selectedDate)
                    logCard
                }
                .padding(16)
            }
            .background(store.theme.background)
            .navigationTitle("Foodie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { dateSelector }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingTrends = true } label: {
                        Image(systemName: "chart.xyaxis.line")
                    }
                    .accessibilityLabel("Trends")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingSettings = true } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView().environmentObject(store)
            }
            .sheet(isPresented: $showingTrends) {
                TrendsView().environmentObject(store)
            }
        }
    }

    // MARK: - Date selector

    private var dateSelector: some View {
        HStack(spacing: 12) {
            Button {
                shift(by: -1)
            } label: { Image(systemName: "chevron.left") }

            Text(dateLabel)
                .font(.headline)
                .frame(minWidth: 96)
                .onTapGesture { withAnimation { selectedDate = Date() } }

            Button {
                shift(by: 1)
            } label: { Image(systemName: "chevron.right") }
            .disabled(isToday)
            .opacity(isToday ? 0.3 : 1)
        }
    }

    private var dateLabel: String {
        if isToday { return "Today" }
        if Calendar.current.isDateInYesterday(selectedDate) { return "Yesterday" }
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d"
        return f.string(from: selectedDate)
    }

    private func shift(by days: Int) {
        if let d = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) {
            withAnimation { selectedDate = min(d, Date()) }
        }
    }

    // MARK: - Summary

    private var summaryCard: some View {
        VStack(spacing: 16) {
            RingView(eaten: totals.kcal, goal: store.goal)
            Divider()
            HStack(spacing: 0) {
                MacroView(value: totals.protein, label: "Protein")
                Divider().frame(height: 34)
                MacroView(value: totals.carbs, label: "Carbs")
                Divider().frame(height: 34)
                MacroView(value: totals.fat, label: "Fat")
            }
        }
        .padding(20)
        .background(store.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    // MARK: - Log

    private var logCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Log").font(.headline)
                Spacer()
                Text("\(entries.count) \(entries.count == 1 ? "item" : "items")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if entries.isEmpty {
                Text("No food logged yet. Add your first item above. 🥑")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(entries.reversed()) { entry in
                    LogRow(entry: entry) {
                        withAnimation { store.delete(entry, from: selectedDate) }
                    }
                    if entry.id != entries.first?.id {
                        Divider()
                    }
                }
            }
        }
        .padding(16)
        .background(store.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// A single row in the day's log, with a swipe- and tap-to-delete affordance.
struct LogRow: View {
    let entry: FoodEntry
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name).font(.body.weight(.semibold)).lineLimit(1)
                if let macros = entry.macroSummary {
                    Text(macros).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            Text("\(entry.kcal) kcal")
                .font(.body.weight(.bold))
                .monospacedDigit()
            Button(role: .destructive, action: onDelete) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.tertiary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Delete \(entry.name)")
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    ContentView().environmentObject(FoodStore(fileURL:
        FileManager.default.temporaryDirectory.appendingPathComponent("preview.json")))
}
