import SwiftUI

/// The daily calorie progress ring with eaten / goal / remaining in the center.
struct RingView: View {
    @EnvironmentObject var store: FoodStore
    let eaten: Int
    let goal: Int

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(Double(eaten) / Double(goal), 1)
    }
    private var over: Bool { eaten > goal }
    private var remaining: Int { goal - eaten }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemGray5), lineWidth: 14)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    over ? Color.red : store.theme.accent,
                    style: StrokeStyle(lineWidth: 14, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: progress)

            VStack(spacing: 2) {
                Text("\(eaten)")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text("of \(goal) kcal")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(over ? "\(abs(remaining)) over" : "\(remaining) left")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(over ? .red : store.theme.accent)
                    .padding(.top, 2)
            }
        }
        .frame(width: 200, height: 200)
        .padding(.vertical, 4)
    }
}

/// One macro column (Protein / Carbs / Fat).
struct MacroView: View {
    let value: Int
    let label: String
    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.title3.weight(.bold))
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
