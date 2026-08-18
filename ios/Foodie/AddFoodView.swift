import SwiftUI

/// The "Add food" card: name + calories (+ optional macros), plus recent chips.
struct AddFoodView: View {
    @EnvironmentObject var store: FoodStore
    let date: Date

    @State private var name = ""
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @FocusState private var nameFocused: Bool
    @State private var showSearch = false
    @State private var searchStartsScanning = false

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (Int(kcal) ?? 0) > 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add food").font(.headline)

            HStack(spacing: 8) {
                Button {
                    searchStartsScanning = false
                    showSearch = true
                } label: {
                    Label("Search foods", systemImage: "magnifyingglass")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.bordered)

                Button {
                    searchStartsScanning = true
                    showSearch = true
                } label: {
                    Label("Scan", systemImage: "barcode.viewfinder")
                        .font(.subheadline.weight(.semibold))
                        .padding(.vertical, 12)
                        .padding(.horizontal, 4)
                }
                .buttonStyle(.bordered)
            }

            TextField("Food (e.g. Banana)", text: $name)
                .textInputAutocapitalization(.words)
                .focused($nameFocused)
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            HStack(spacing: 8) {
                numberField("kcal", text: $kcal)
                numberField("P (g)", text: $protein)
                numberField("C (g)", text: $carbs)
                numberField("F (g)", text: $fat)
            }

            Button(action: add) {
                Text("Add")
                    .font(.body.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(store.theme.onAccent)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canAdd)

            if !store.recents.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.recents.prefix(8), id: \.self) { r in
                            Button {
                                store.add(r, to: date)
                            } label: {
                                HStack(spacing: 6) {
                                    Text(r.name).fontWeight(.semibold)
                                    Text("\(r.kcal)").foregroundStyle(.secondary)
                                }
                                .font(.footnote)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color(.systemGray6))
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(store.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .sheet(isPresented: $showSearch) {
            FoodSearchView(date: date, startScanning: searchStartsScanning)
                .environmentObject(store)
        }
    }

    private func numberField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .padding(12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func add() {
        let entry = FoodEntry(
            name: name,
            kcal: Int(kcal) ?? 0,
            protein: Int(protein) ?? 0,
            carbs: Int(carbs) ?? 0,
            fat: Int(fat) ?? 0
        )
        store.add(entry, to: date)
        name = ""; kcal = ""; protein = ""; carbs = ""; fat = ""
        nameFocused = true
    }
}
