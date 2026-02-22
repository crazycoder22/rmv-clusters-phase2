import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.rmvclustersphase2.app",
  appName: "RMV Clusters",
  webDir: "public",
  server: {
    url: "https://www.rmvclustersphase2.in",
    cleartext: false,
  },
};

export default config;
