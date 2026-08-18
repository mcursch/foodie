import AVFoundation
import SwiftUI
import UIKit
import VisionKit

/// Full-screen camera barcode scanner built on VisionKit's DataScanner.
///
/// Reports the first barcode it reads and then stops, so the caller can look it
/// up. Falls back to a typed-in barcode when the camera isn't usable (older
/// devices, the Simulator, or a denied permission).
struct BarcodeScannerView: View {
    /// Called with the raw barcode payload once.
    let onScan: (String) -> Void

    @EnvironmentObject var store: FoodStore
    @Environment(\.dismiss) private var dismiss
    @State private var permission: PermissionState = .checking
    @State private var manualCode = ""
    @FocusState private var manualFocused: Bool

    private enum PermissionState {
        case checking, granted, denied, unsupported
    }

    var body: some View {
        NavigationStack {
            Group {
                switch permission {
                case .checking:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .granted:
                    scanner
                case .denied:
                    fallback(
                        title: "Camera access is off",
                        message: "Enable the camera in Settings to scan barcodes, or type the number below."
                    )
                case .unsupported:
                    fallback(
                        title: "Scanning isn't available",
                        message: "This device can't scan barcodes. Type the number under the barcode instead."
                    )
                }
            }
            .navigationTitle("Scan barcode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task { await resolvePermission() }
    }

    // MARK: - Camera

    private var scanner: some View {
        ZStack(alignment: .bottom) {
            DataScannerRepresentable(onScan: onScan)
                .ignoresSafeArea(edges: .bottom)

            Text("Point the camera at a product barcode")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.black.opacity(0.55), in: Capsule())
                .padding(.bottom, 32)
        }
    }

    // MARK: - Fallback

    private func fallback(title: String, message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "barcode.viewfinder")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            TextField("Barcode number", text: $manualCode)
                .keyboardType(.numberPad)
                .focused($manualFocused)
                .multilineTextAlignment(.center)
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Button("Look up") { onScan(manualCode) }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(store.theme.onAccent)
                .disabled(manualCode.count < 6)

            if permission == .denied {
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.footnote)
            }
        }
        .padding(24)
        .frame(maxHeight: .infinity)
        .onAppear { manualFocused = true }
    }

    @MainActor
    private func resolvePermission() async {
        guard DataScannerViewController.isSupported, DataScannerViewController.isAvailable else {
            permission = .unsupported
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            permission = .granted
        case .notDetermined:
            permission = await AVCaptureDevice.requestAccess(for: .video) ? .granted : .denied
        default:
            permission = .denied
        }
    }
}

// MARK: - VisionKit bridge

private struct DataScannerRepresentable: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128, .code39, .itf14])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {
        // start/stop are no-ops when already in that state, so this is safe to
        // re-run on every SwiftUI update.
        if context.coordinator.isFinished {
            controller.stopScanning()
        } else {
            try? controller.startScanning()
        }
    }

    static func dismantleUIViewController(_ controller: DataScannerViewController, coordinator: Coordinator) {
        controller.stopScanning()
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        private let onScan: (String) -> Void
        private(set) var isFinished = false

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ scanner: DataScannerViewController,
                         didAdd addedItems: [RecognizedItem],
                         allItems: [RecognizedItem]) {
            guard !isFinished else { return }
            for item in addedItems {
                guard case let .barcode(barcode) = item,
                      let payload = barcode.payloadStringValue,
                      !payload.isEmpty
                else { continue }

                isFinished = true
                scanner.stopScanning()
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                onScan(payload)
                return
            }
        }
    }
}
