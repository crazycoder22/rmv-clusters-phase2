package `in`.rmvclustersphase2.app

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregationResultGroupedByPeriod
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId

// Custom Capacitor plugin bridging Android Health Connect so the JS layer can
// read daily step totals — the Android equivalent of HealthKitPlugin on iOS.
// Read-only (StepsRecord). Gated at runtime via getSdkStatus so the app still
// runs on devices without Health Connect (Android < 14 without the app, etc.).
@CapacitorPlugin(name = "StepHealth")
class StepHealthPlugin : Plugin() {

    private val readPerm = HealthPermission.getReadPermission(StepsRecord::class)

    private fun isAvailable(): Boolean {
        return try {
            HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
        } catch (e: Exception) {
            false
        }
    }

    private fun clientOrNull(): HealthConnectClient? {
        return if (isAvailable()) {
            try {
                HealthConnectClient.getOrCreate(context)
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }

    @PluginMethod
    fun available(call: PluginCall) {
        val res = JSObject()
        res.put("available", isAvailable())
        call.resolve(res)
    }

    @PluginMethod
    fun requestAuth(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) {
            val res = JSObject()
            res.put("granted", false)
            call.resolve(res)
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.contains(readPerm)) {
                    val res = JSObject()
                    res.put("granted", true)
                    call.resolve(res)
                    return@launch
                }
                val contract = PermissionController.createRequestPermissionResultContract()
                val intent = contract.createIntent(context, setOf(readPerm))
                startActivityForResult(call, intent, "authResult")
            } catch (e: Exception) {
                val res = JSObject()
                res.put("granted", false)
                call.resolve(res)
            }
        }
    }

    @ActivityCallback
    fun authResult(call: PluginCall?, result: ActivityResult?) {
        if (call == null) return
        val client = clientOrNull()
        if (client == null) {
            val res = JSObject()
            res.put("granted", false)
            call.resolve(res)
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            val granted = try {
                client.permissionController.getGrantedPermissions()
            } catch (e: Exception) {
                emptySet()
            }
            val res = JSObject()
            res.put("granted", granted.contains(readPerm))
            call.resolve(res)
        }
    }

    @PluginMethod
    fun readStepsByDay(call: PluginCall) {
        val client = clientOrNull()
        val startISO = call.getString("startISO")
        val endISO = call.getString("endISO")
        if (client == null || startISO == null || endISO == null) {
            val res = JSObject()
            res.put("buckets", JSArray())
            call.resolve(res)
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val zone = ZoneId.systemDefault()
                val startLdt = LocalDateTime.ofInstant(Instant.parse(startISO), zone)
                val endLdt = LocalDateTime.ofInstant(Instant.parse(endISO), zone)
                val response = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(startLdt, endLdt),
                        timeRangeSlicer = Period.ofDays(1)
                    )
                )
                val arr = JSArray()
                for (group: AggregationResultGroupedByPeriod in response) {
                    val count = group.result[StepsRecord.COUNT_TOTAL] ?: 0L
                    val obj = JSObject()
                    obj.put("date", group.startTime.toLocalDate().toString())
                    obj.put("steps", count)
                    arr.put(obj)
                }
                val res = JSObject()
                res.put("buckets", arr)
                call.resolve(res)
            } catch (e: Exception) {
                val res = JSObject()
                res.put("buckets", JSArray())
                call.resolve(res)
            }
        }
    }
}
