// Subclass of Capacitor's bridge view controller so we can register LOCAL
// custom Swift plugins (anything in the App target rather than an npm
// package). Auto-discovery in Capacitor 8 reliably finds Pod/SPM plugins
// but is unreliable for local Swift classes — even with @objc and
// CAPBridgedPlugin, the bridge often never picks them up.
//
// `capacitorDidLoad` is the canonical hook to register plugin instances
// against the bridge. After this runs, `registerPlugin("HealthKit")` in
// JS resolves to our Swift implementation instead of a stub that throws.

import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
        NSLog("[OneRMV] Registered local plugin: HealthKit")
    }
}
