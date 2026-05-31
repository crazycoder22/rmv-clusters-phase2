// Universal Links / deep-link handler for the Capacitor iOS shell.
//
// When iOS sees a URL on rmvclustersphase2.in (or www.) that matches our
// Associated Domains entitlement and apple-app-site-association file, it
// opens the app and fires the 'appUrlOpen' event instead of Safari.
//
// This handler parses the incoming URL path and navigates to the right
// in-app screen, mirroring the web routing.
//
// On the web (non-native) this is a no-op.

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type NavigateFn = (path: string) => void;

let listenerInstalled = false;

export function initDeepLinks(navigate: NavigateFn): void {
  if (!Capacitor.isNativePlatform()) return;
  if (listenerInstalled) return;
  listenerInstalled = true;

  App.addListener("appUrlOpen", (event) => {
    try {
      const url = new URL(event.url);
      const path = url.pathname; // e.g. "/parking/abc123"
      routeDeepLink(path, navigate);
    } catch (err) {
      console.warn("[deeplink] could not parse URL", event.url, err);
    }
  });
}

function routeDeepLink(path: string, navigate: NavigateFn): void {
  // Exact matches first, then prefix matches.
  if (path === "/parking") { navigate("/parking"); return; }
  if (path.startsWith("/parking/")) { navigate(path); return; }

  if (path === "/food") { navigate("/food"); return; }
  if (path.startsWith("/food/")) { navigate(path); return; }

  if (path === "/initiatives") { navigate("/initiatives"); return; }
  if (path.startsWith("/initiatives/")) { navigate(path); return; }

  if (path === "/referendums") { navigate("/referendums"); return; }
  if (path.startsWith("/referendums/")) { navigate(path); return; }

  if (path === "/habits") { navigate("/habits"); return; }
  if (path.startsWith("/habits/")) { navigate(path); return; }

  if (path === "/duties") { navigate("/duties"); return; }

  if (path.startsWith("/community/")) { navigate(path); return; }
  if (path.startsWith("/news/")) { navigate(path); return; }

  // Unknown path — go home and let the resident find their way.
  navigate("/");
}
