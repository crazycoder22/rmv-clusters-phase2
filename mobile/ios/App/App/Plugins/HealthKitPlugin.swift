// Custom Capacitor plugin: thin Swift bridge over HealthKit so the OneRMV
// JS layer can read daily step totals for Stepup challenges.
//
// Two reasons we own this instead of pulling in an npm plugin:
//   1. The two popular community plugins peer-depend on Capacitor 4 or 7;
//      we're on 8.3 and don't want to fight version skew / patch-package.
//   2. Our needs are tiny — read-only step aggregation by day. ~80 lines of
//      Swift is genuinely smaller than the third-party plugin's API.
//
// JS side: see mobile/src/lib/healthkit.ts which calls
//   registerPlugin<HealthKitPlugin>("HealthKit").
// Native registration: see HealthKitPlugin.m in this same folder.

import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuth",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readStepsByDay",  returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    private var stepType: HKQuantityType {
        // Force-unwrap is fine: HKQuantityType(forIdentifier:) only returns
        // nil for identifiers the iOS version doesn't know about, and
        // .stepCount has existed since iOS 8.
        HKQuantityType.quantityType(forIdentifier: .stepCount)!
    }

    // ── Methods exposed to JS ────────────────────────────────────────────

    /// Check whether HealthKit data is even available on this device. Always
    /// false on iPad without HealthKit data — useful for the UI to hide the
    /// "Sync from Health" button entirely when there's nothing to sync.
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    /// Request read permission for step count. Apple intentionally never
    /// tells you whether the user said yes or no — for privacy reasons —
    /// so `granted` here only signals "the prompt was shown without error".
    /// The real test is whether subsequent queries return data.
    @objc func requestAuth(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: nil, read: [stepType]) { ok, err in
            if let err = err {
                call.reject("HealthKit authorization failed", nil, err)
                return
            }
            call.resolve(["granted": ok])
        }
    }

    /// Aggregate step count per calendar day across the given window.
    ///
    /// JS input:
    ///   { startISO: "2026-05-01T00:00:00Z", endISO: "2026-05-15T23:59:59Z" }
    ///
    /// JS output:
    ///   { buckets: [{ date: "2026-05-01", steps: 8432 }, …] }
    ///
    /// Important: dates returned are ISO date strings (yyyy-MM-dd) in the
    /// device's CURRENT calendar/timezone, NOT UTC. The server normalises
    /// to UTC midnight when storing — matches admin route convention.
    @objc func readStepsByDay(_ call: CAPPluginCall) {
        guard let startISO = call.getString("startISO"),
              let endISO   = call.getString("endISO") else {
            call.reject("startISO and endISO required")
            return
        }

        let iso = ISO8601DateFormatter()
        // Accept both with and without fractional seconds — JS Date.toISOString()
        // returns the fractional form by default.
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var startDate = iso.date(from: startISO)
        if startDate == nil {
            iso.formatOptions = [.withInternetDateTime]
            startDate = iso.date(from: startISO)
        }
        var endDate = iso.date(from: endISO)
        if endDate == nil {
            iso.formatOptions = [.withInternetDateTime]
            endDate = iso.date(from: endISO)
        }
        guard let start = startDate, let end = endDate else {
            call.reject("startISO/endISO must be valid ISO-8601 timestamps")
            return
        }

        let cal = Calendar.current
        let anchor = cal.startOfDay(for: start)
        let interval = DateComponents(day: 1)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate])

        let query = HKStatisticsCollectionQuery(
            quantityType: stepType,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum,
            anchorDate: anchor,
            intervalComponents: interval
        )

        // Format dates as "yyyy-MM-dd" in the local calendar — same shape
        // the server expects in the entries[].date field.
        let dateFmt = DateFormatter()
        dateFmt.calendar = cal
        dateFmt.timeZone = cal.timeZone
        dateFmt.dateFormat = "yyyy-MM-dd"

        query.initialResultsHandler = { _, results, error in
            if let error = error {
                call.reject("HealthKit query failed", nil, error)
                return
            }
            var out: [[String: Any]] = []
            results?.enumerateStatistics(from: start, to: end) { stat, _ in
                let qty = stat.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
                out.append([
                    "date": dateFmt.string(from: stat.startDate),
                    "steps": qty,
                ])
            }
            call.resolve(["buckets": out])
        }

        store.execute(query)
    }
}
