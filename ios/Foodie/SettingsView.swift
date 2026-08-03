import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject var store: FoodStore
    @Environment(\.dismiss) private var dismiss

    @State private var goalText = ""
    @State private var showingImporter = false
    @State private var exportURL: URL?
    @State private var importMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Daily goal") {
                    HStack {
                        Text("Calories")
                        Spacer()
                        TextField("2000", text: $goalText)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                        Text("kcal").foregroundStyle(.secondary)
                    }
                }

                Section("Your data") {
                    if let url = exportURL {
                        ShareLink(item: url) {
                            Label("Export backup", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button {
                        showingImporter = true
                    } label: {
                        Label("Import backup", systemImage: "square.and.arrow.down")
                    }
                    if let msg = importMessage {
                        Text(msg).font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Foodie").font(.footnote.weight(.semibold))
                        Text("Free & offline. Your data stays on this device.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { commitGoal(); dismiss() }
                }
            }
            .onAppear {
                goalText = String(store.goal)
                refreshExport()
            }
            .fileImporter(isPresented: $showingImporter,
                          allowedContentTypes: [.json],
                          allowsMultipleSelection: false) { result in
                handleImport(result)
            }
        }
    }

    private func commitGoal() {
        if let g = Int(goalText) {
            store.goal = min(max(g, 500), 10000)
        }
    }

    /// Write the current data to a temp file so ShareLink can hand it off.
    private func refreshExport() {
        let data = store.exportData()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("foodie-backup.json")
        try? data.write(to: url, options: [.atomic])
        exportURL = url
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        guard case let .success(urls) = result, let url = urls.first else {
            importMessage = "Import canceled."
            return
        }
        let needsStop = url.startAccessingSecurityScopedResource()
        defer { if needsStop { url.stopAccessingSecurityScopedResource() } }

        guard let data = try? Data(contentsOf: url) else {
            importMessage = "Couldn't read that file."
            return
        }
        if store.importData(data) {
            goalText = String(store.goal)
            refreshExport()
            importMessage = "Import successful."
        } else {
            importMessage = "That doesn't look like a Foodie backup."
        }
    }
}
