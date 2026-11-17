interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
  };
  android?: {
    allowMixedContent?: boolean;
    backgroundColor?: string;
  };
}

const config: CapacitorConfig = {
  appId: 'in.ac.griet.masterjee.physics11',
  appName: 'MASTER JEE – Class 11 Physics',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0B1F3A',
  },
};

export default config;
