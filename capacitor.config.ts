import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gorillacoding.filament",
  appName: "Filament",
  webDir: "dist",
  server: { androidScheme: "https" },
  backgroundColor: "#12110f",
};

export default config;
