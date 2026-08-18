import SwiftUI

/// The app's color theme. Mirrors the web app's theme swapper (`web/styles.css`)
/// so the same palettes exist on both platforms.
enum AppTheme: String, Codable, CaseIterable, Identifiable {
    case auto, black, white, blue, pink
    var id: String { rawValue }

    var label: String {
        switch self {
        case .auto: return "Auto"
        case .black: return "Black"
        case .white: return "White"
        case .blue: return "Blue"
        case .pink: return "Pink"
        }
    }

    /// `nil` lets the system decide, following the device's light/dark setting.
    var colorScheme: ColorScheme? {
        switch self {
        case .auto: return nil
        case .black: return .dark
        case .white, .blue, .pink: return .light
        }
    }

    /// Screen background. Dynamic (light/dark adaptive) for `auto`, fixed for the rest.
    var background: Color {
        switch self {
        case .auto: return Color(.systemGroupedBackground)
        case .black: return .black
        case .white: return Color(red: 0.980, green: 0.980, blue: 0.980)
        case .blue: return Color(red: 0.933, green: 0.957, blue: 0.984)
        case .pink: return Color(red: 0.992, green: 0.945, blue: 0.965)
        }
    }

    /// Card / grouped-row background, one step lighter than `background`.
    var card: Color {
        switch self {
        case .auto: return Color(.secondarySystemGroupedBackground)
        case .black: return Color(red: 0.071, green: 0.071, blue: 0.071)
        case .white, .blue, .pink: return .white
        }
    }

    /// Brand accent — drives the app-wide tint, the progress ring, and chart lines.
    var accent: Color {
        switch self {
        case .auto: return Color(red: 0.13, green: 0.77, blue: 0.37)
        case .black: return Color(red: 0.961, green: 0.706, blue: 0.0)
        case .white: return Color(red: 0.067, green: 0.067, blue: 0.067)
        case .blue: return Color(red: 0.145, green: 0.388, blue: 0.922)
        case .pink: return Color(red: 0.859, green: 0.153, blue: 0.467)
        }
    }

    /// Text/icon color that stays legible on top of a filled `accent` shape
    /// (gold needs dark text; every other accent is dark enough for white).
    var onAccent: Color {
        self == .black ? Color(red: 0.102, green: 0.071, blue: 0.0) : .white
    }
}

/// Row of tappable swatches for choosing an `AppTheme`, used in Settings.
struct ThemePicker: View {
    @Binding var selection: AppTheme

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTheme.allCases) { theme in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { selection = theme }
                } label: {
                    VStack(spacing: 6) {
                        swatch(for: theme)
                            .frame(width: 40, height: 40)
                            .overlay {
                                if selection == theme {
                                    Circle()
                                        .stroke(theme.accent, lineWidth: 2)
                                        .padding(-3)
                                }
                            }
                        Text(theme.label)
                            .font(.caption)
                            .foregroundStyle(selection == theme ? .primary : .secondary)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private func swatch(for theme: AppTheme) -> some View {
        if theme == .auto {
            Circle()
                .fill(LinearGradient(colors: [.white, .black],
                                      startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(Circle().strokeBorder(.separator, lineWidth: 1))
        } else {
            Circle()
                .fill(theme.background)
                .overlay(Circle().strokeBorder(.separator, lineWidth: 1))
        }
    }
}
