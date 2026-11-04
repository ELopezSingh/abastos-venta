import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chiles.ventas',
  appName: 'Ventas Chiles',
  webDir: 'dist/frontend/browser',
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
