import SwiftUI

/// The "Search foods" sheet: type to search the bundled table plus Open Food
/// Facts, or scan a barcode. Picking a result opens the portion screen.
struct FoodSearchView: View {
    @EnvironmentObject var store: FoodStore
    let date: Date
    /// Open straight into the camera — used by the "Scan" button on the card.
    var startScanning: Bool = false

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var commonHits: [FoodHit] = []
    @State private var brandedHits: [FoodHit] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    @State private var showScanner = false
    @State private var lookupError: String?
    @State private var isLookingUp = false
    @State private var selection: FoodHit?

    var body: some View {
        NavigationStack {
            List {
                if !commonHits.isEmpty {
                    Section("Common foods") {
                        ForEach(commonHits) { hit in row(hit) }
                    }
                }
                if !brandedHits.isEmpty {
                    Section("Branded products") {
                        ForEach(brandedHits) { hit in row(hit) }
                    }
                }
                if shouldShowEmptyState {
                    Section {
                        ContentUnavailableView(
                            "No matches",
                            systemImage: "magnifyingglass",
                            description: Text("Try a shorter word, or scan the product's barcode.")
                        )
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Add food")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Search foods")
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showScanner = true
                    } label: {
                        Label("Scan barcode", systemImage: "barcode.viewfinder")
                    }
                }
            }
            .overlay {
                if isLookingUp {
                    ProgressView("Looking up…")
                        .padding(20)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
            }
            .navigationDestination(item: $selection) { hit in
                PortionView(hit: hit) { entry in
                    store.add(entry, to: date)
                    dismiss()
                }
            }
        }
        .onChange(of: query) { _, newValue in scheduleSearch(newValue) }
        .onAppear { if startScanning { showScanner = true } }
        .sheet(isPresented: $showScanner) {
            BarcodeScannerView { code in
                showScanner = false
                lookUp(barcode: code)
            }
        }
        .alert("Barcode", isPresented: Binding(
            get: { lookupError != nil },
            set: { if !$0 { lookupError = nil } }
        )) {
            Button("OK", role: .cancel) { lookupError = nil }
        } message: {
            Text(lookupError ?? "")
        }
    }

    private var shouldShowEmptyState: Bool {
        query.trimmingCharacters(in: .whitespaces).count >= 2
            && commonHits.isEmpty && brandedHits.isEmpty && !isSearching
    }

    private func row(_ hit: FoodHit) -> some View {
        Button {
            selection = hit
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(hit.name)
                    .font(.body)
                    .foregroundStyle(.primary)
                HStack(spacing: 6) {
                    if let brand = hit.brand, !brand.isEmpty {
                        Text(brand)
                        Text("·")
                    }
                    Text("\(Int(hit.kcal.rounded())) kcal / 100 g")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)
        }
    }

    // MARK: - Search

    /// Bundled results update on every keystroke; the network call is debounced.
    /// @MainActor so the Task below inherits it and can touch @State directly.
    @MainActor
    private func scheduleSearch(_ text: String) {
        searchTask?.cancel()
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

        commonHits = FoodSearchService.shared.searchCommon(trimmed)
        guard trimmed.count >= 2 else {
            brandedHits = []
            isSearching = false
            return
        }

        isSearching = true
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            let results = await FoodSearchService.shared.searchProducts(trimmed)
            guard !Task.isCancelled else { return }
            brandedHits = results
            isSearching = false
        }
    }

    @MainActor
    private func lookUp(barcode: String) {
        isLookingUp = true
        Task {
            defer { isLookingUp = false }
            do {
                selection = try await FoodSearchService.shared.lookup(barcode: barcode)
            } catch {
                lookupError = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't look up that barcode."
            }
        }
    }
}

// MARK: - Portion picker

/// Choose how much of a found food to log, with a live macro preview.
struct PortionView: View {
    @EnvironmentObject var store: FoodStore
    let hit: FoodHit
    let onAdd: (FoodEntry) -> Void

    @State private var portionIndex = 0
    @State private var count = "1"
    @State private var customGrams = ""

    private var options: [Serving] { hit.portionOptions }
    private var isCustom: Bool { portionIndex == options.count }

    /// Total grams for the current selection, clamped to something sane.
    private var grams: Double {
        let raw: Double
        if isCustom {
            raw = Double(customGrams.replacingOccurrences(of: ",", with: ".")) ?? 0
        } else {
            let multiplier = Double(count.replacingOccurrences(of: ",", with: ".")) ?? 0
            raw = options[portionIndex].grams * multiplier
        }
        return min(max(raw, 0), 5000)
    }

    private var preview: FoodEntry { hit.entry(grams: grams) }

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(hit.name).font(.headline)
                    if let brand = hit.brand, !brand.isEmpty {
                        Text(brand).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Text("\(Int(hit.kcal.rounded())) kcal per 100 g")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)
            }

            Section("Portion") {
                Picker("Serving", selection: $portionIndex) {
                    ForEach(options.indices, id: \.self) { i in
                        Text(FoodHit.portionLabel(options[i])).tag(i)
                    }
                    Text("Custom weight").tag(options.count)
                }

                if isCustom {
                    HStack {
                        Text("Grams")
                        Spacer()
                        TextField("0", text: $customGrams)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                    }
                } else {
                    HStack {
                        Text("How many")
                        Spacer()
                        TextField("1", text: $count)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                    }
                }
            }

            Section("You'll log") {
                LabeledContent("Calories", value: "\(preview.kcal) kcal")
                LabeledContent("Protein", value: "\(preview.protein) g")
                LabeledContent("Carbs", value: "\(preview.carbs) g")
                LabeledContent("Fat", value: "\(preview.fat) g")
                LabeledContent("Weight", value: "\(Int(grams.rounded())) g")
            }

            Section {
                Button {
                    onAdd(preview)
                } label: {
                    Text("Add to log")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(store.theme.onAccent)
                }
                .buttonStyle(.borderedProminent)
                .disabled(preview.kcal <= 0)
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
        }
        .navigationTitle("Portion")
        .navigationBarTitleDisplayMode(.inline)
    }
}
