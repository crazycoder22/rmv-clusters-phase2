package in.rmvclustersphase2.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15 (API 35) and Android 16 (API 36, our compileSdk)
        // draw apps edge-to-edge by default — the WebView extends behind
        // the system gesture / 3-button nav bar, so the app's own
        // BottomNav (Home / Games / News / More) stacks on top of the
        // system nav and is hard to tap.
        //
        // The theme attribute `android:fitsSystemWindows="true"` alone
        // doesn't kick in for Capacitor's BridgeActivity because the
        // WebView is added programmatically after super.onCreate. We
        // also flip the decor-fits-system-windows flag here so the
        // WebView gets the visible window area and the system bars
        // stay outside it.
        //
        // Tradeoff: the bottom of our app no longer touches the screen
        // edge, but every tap target stays reachable.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
