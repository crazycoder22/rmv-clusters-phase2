// Objective-C registration for HealthKitPlugin. In Capacitor 7+, the
// CAPBridgedPlugin protocol in the Swift class can do the same job, but
// keeping this file means we register correctly across any Cap version
// drift and our Pod build doesn't need to find the Swift symbol via
// reflection.
//
// The first argument is the Swift class name; the second is the JS name
// used by registerPlugin<HealthKitPlugin>("HealthKit") in TS.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthKitPlugin, "HealthKit",
    CAP_PLUGIN_METHOD(isAvailable,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuth,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(readStepsByDay, CAPPluginReturnPromise);
)
