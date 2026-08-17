import Foundation

// MARK: - Models

/// One entry in the bundled offline table (see CommonFoods.swift). Per 100 g.
struct CommonFood: Identifiable, Hashable {
    let id: String
    let name: String
    let kcal: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let servings: [Serving]
}

/// A named portion, e.g. "1 medium" = 118 g.
struct Serving: Hashable {
    let label: String
    let grams: Double
}

/// A search result from either source, normalised to per-100 g macros so the
/// portion picker can scale everything the same way.
struct FoodHit: Identifiable, Hashable {
    enum Source: Hashable { case common, openFoodFacts }

    let id: String
    let name: String
    let brand: String?
    let kcal: Double      // per 100 g
    let protein: Double   // per 100 g
    let carbs: Double     // per 100 g
    let fat: Double       // per 100 g
    let servings: [Serving]
    let source: Source

    /// Portions offered in the picker: the food's own servings, then 100 g.
    var portionOptions: [Serving] {
        servings + [Serving(label: "100 g", grams: 100)]
    }

    /// Picker text for a serving. Open Food Facts labels often already spell out
    /// the weight ("1 portion (40 g)"), so only append it when it's missing.
    static func portionLabel(_ serving: Serving) -> String {
        let hasWeight = serving.label.range(of: #"\d\s*g\b"#, options: .regularExpression) != nil
        return hasWeight ? serving.label : "\(serving.label) (\(Int(serving.grams.rounded())) g)"
    }

    /// Scale to a gram weight and round into the integer-only FoodEntry shape.
    func entry(grams: Double) -> FoodEntry {
        let k = grams / 100
        let title = [brand, name].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        return FoodEntry(
            name: title.isEmpty ? name : title,
            kcal: Int((kcal * k).rounded()),
            protein: Int((protein * k).rounded()),
            carbs: Int((carbs * k).rounded()),
            fat: Int((fat * k).rounded())
        )
    }
}

// MARK: - Errors

enum FoodSearchError: LocalizedError {
    case notFound
    case noNutrition
    case offline
    case server

    var errorDescription: String? {
        switch self {
        case .notFound:    return "No product found for that barcode."
        case .noNutrition: return "That product has no nutrition data yet."
        case .offline:     return "You're offline — bundled foods still work."
        case .server:      return "Food database is busy. Try again in a moment."
        }
    }
}

// MARK: - Service

/// Looks foods up in the bundled table first, then Open Food Facts.
///
/// Open Food Facts is free, needs no API key and has no monthly quota; it only
/// asks that clients send an identifying User-Agent, which we do below.
actor FoodSearchService {
    static let shared = FoodSearchService()

    private let session: URLSession
    /// Barcode results are stable, so keep them for the life of the process.
    private var barcodeCache: [String: FoodHit] = [:]

    init(session: URLSession? = nil) {
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 12
            config.waitsForConnectivity = false
            config.httpAdditionalHeaders = [
                "User-Agent": "Foodie/\(Self.appVersion) (iOS) - https://mcursch.github.io/foodie/"
            ]
            self.session = URLSession(configuration: config)
        }
    }

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    // MARK: Bundled table

    /// Ranked matches from the offline table. Instant, no network.
    nonisolated func searchCommon(_ query: String, limit: Int = 8) -> [FoodHit] {
        let q = query.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return [] }

        return CommonFoods.all
            .compactMap { food -> (FoodHit, Int)? in
                guard let score = Self.score(name: food.name, query: q) else { return nil }
                return (FoodHit(id: "common:\(food.id)", name: food.name, brand: nil,
                                kcal: food.kcal, protein: food.protein, carbs: food.carbs,
                                fat: food.fat, servings: food.servings, source: .common), score)
            }
            // Ties keep the alphabetical order the generated table is already in.
            .sorted { $0.1 > $1.1 }
            .prefix(limit)
            .map(\.0)
    }

    /// Higher is better; nil means no match. Prefers whole-name prefixes, then
    /// word starts, so "chick" ranks "Chicken breast" above "Chickpeas".
    private static func score(name: String, query: String) -> Int? {
        let n = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        guard let range = n.range(of: query) else { return nil }
        if range.lowerBound == n.startIndex { return 100 - n.count / 4 }
        let before = n[n.index(before: range.lowerBound)]
        if before == " " || before == "," || before == "-" { return 60 - n.count / 4 }
        return 20 - n.count / 4
    }

    // MARK: Open Food Facts — text search

    /// Branded products matching `query`. Returns [] rather than throwing when
    /// the network or the service is unavailable — bundled results still show.
    func searchProducts(_ query: String, limit: Int = 20) async -> [FoodHit] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return [] }
        guard var comps = URLComponents(string: "https://search.openfoodfacts.org/search") else { return [] }
        comps.queryItems = [
            URLQueryItem(name: "q", value: q),
            URLQueryItem(name: "page_size", value: String(limit)),
            URLQueryItem(name: "fields", value: "code,product_name,brands,nutriments,serving_size"),
        ]
        guard let url = comps.url else { return [] }

        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return [] }
            let payload = try JSONDecoder().decode(SearchResponse.self, from: data)
            // OFF holds one entry per country/packaging, so a popular product comes
            // back a dozen times. Collapse rows that agree on brand, name and kcal.
            var seen = Set<String>()
            return payload.hits.compactMap { $0.toHit() }.filter { hit in
                let key = "\((hit.brand ?? "").lowercased())|\(hit.name.lowercased())|\(Int(hit.kcal.rounded()))"
                return seen.insert(key).inserted
            }
        } catch {
            return []
        }
    }

    // MARK: Open Food Facts — barcode

    /// Look up a scanned barcode. Throws so the scanner can explain failures.
    func lookup(barcode: String) async throws -> FoodHit {
        let code = barcode.trimmingCharacters(in: .whitespacesAndNewlines)
        if let cached = barcodeCache[code] { return cached }

        guard var comps = URLComponents(string: "https://world.openfoodfacts.org/api/v2/product/\(code).json")
        else { throw FoodSearchError.notFound }
        comps.queryItems = [
            URLQueryItem(name: "fields", value: "code,product_name,brands,nutriments,serving_size")
        ]
        guard let url = comps.url else { throw FoodSearchError.notFound }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch let error as URLError where error.code == .notConnectedToInternet || error.code == .networkConnectionLost {
            throw FoodSearchError.offline
        } catch {
            throw FoodSearchError.server
        }

        guard let http = response as? HTTPURLResponse else { throw FoodSearchError.server }
        if http.statusCode == 404 { throw FoodSearchError.notFound }
        guard http.statusCode == 200 else { throw FoodSearchError.server }

        guard let payload = try? JSONDecoder().decode(ProductResponse.self, from: data),
              payload.status == 1, let product = payload.product
        else { throw FoodSearchError.notFound }

        guard let hit = product.toHit(code: code) else { throw FoodSearchError.noNutrition }
        barcodeCache[code] = hit
        return hit
    }
}

// MARK: - Wire format

/// Open Food Facts returns `brands` as a comma string on the product endpoint
/// but as an array on the search endpoint, so decode either shape.
private struct FlexibleBrands: Decodable {
    let value: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let s = try? container.decode(String.self) {
            value = s.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) }
        } else if let a = try? container.decode([String].self) {
            value = a.first
        } else {
            value = nil
        }
    }
}

private struct OFFProduct: Decodable {
    let code: String?
    let productName: String?
    let brands: FlexibleBrands?
    let nutriments: [String: OFFValue]?
    let servingSize: String?

    enum CodingKeys: String, CodingKey {
        case code
        case productName = "product_name"
        case brands
        case nutriments
        case servingSize = "serving_size"
    }

    /// Build a hit, or nil when the product has no usable calorie figure.
    func toHit(code overrideCode: String? = nil) -> FoodHit? {
        let id = overrideCode ?? code ?? UUID().uuidString
        let name = (productName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return nil }

        // Prefer the explicit kcal field; fall back to converting kJ.
        let kcal: Double
        if let v = num("energy-kcal_100g") ?? num("energy-kcal") {
            kcal = v
        } else if let kj = num("energy_100g") ?? num("energy") {
            kcal = kj / 4.184
        } else {
            return nil
        }
        guard kcal > 0, kcal <= 900 else { return nil }

        var servings: [Serving] = []
        if let grams = OFFProduct.parseGrams(servingSize) {
            servings.append(Serving(label: servingSize ?? "1 serving", grams: grams))
        }

        return FoodHit(
            id: "off:\(id)",
            name: name,
            brand: brands?.value,
            kcal: kcal,
            protein: num("proteins_100g") ?? num("proteins") ?? 0,
            carbs: num("carbohydrates_100g") ?? num("carbohydrates") ?? 0,
            fat: num("fat_100g") ?? num("fat") ?? 0,
            servings: servings,
            source: .openFoodFacts
        )
    }

    private func num(_ key: String) -> Double? {
        guard let v = nutriments?[key]?.double, v.isFinite, v >= 0 else { return nil }
        return v
    }

    /// "30 g", "1 cup (240ml)", "50g" → grams. nil when there's no gram figure.
    static func parseGrams(_ text: String?) -> Double? {
        guard let text, !text.isEmpty else { return nil }
        let pattern = #"([\d]+(?:[.,]\d+)?)\s*(g|ml)\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text)
        else { return nil }
        let value = Double(text[range].replacingOccurrences(of: ",", with: "."))
        guard let value, value > 0, value <= 2000 else { return nil }
        return value
    }
}

/// Nutriment values arrive as numbers or numeric strings depending on the field.
private struct OFFValue: Decodable {
    let double: Double?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let d = try? container.decode(Double.self) {
            double = d
        } else if let s = try? container.decode(String.self) {
            double = Double(s)
        } else {
            double = nil
        }
    }
}

private struct ProductResponse: Decodable {
    let status: Int
    let product: OFFProduct?
}

private struct SearchResponse: Decodable {
    let hits: [OFFProduct]
}
