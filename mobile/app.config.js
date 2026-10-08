module.exports = ({ config }) => {
  // Determine variant from environment variables
  const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
  
  // App Name
  const appName = process.env.APP_NAME || (IS_PREVIEW ? 'Gymholik Preview' : 'Gymholik');
  
  // Package ID
  const packageId = process.env.APP_PACKAGE_ID || (IS_PREVIEW ? 'com.gymholik.app.preview' : 'com.gymholik.app');
  
  // API URL
  const apiUrl = process.env.API_URL || 'http://localhost:8080';
  
  // Icons and Splash (can be overridden by env for different branding)
  const icon = process.env.APP_ICON || './assets/icon.png';
  const splash = process.env.APP_SPLASH || './assets/splash.png';

  return {
    ...config,
    name: appName,
    slug: 'gymholik',
    scheme: 'gymholik',
    version: '1.0.0',
    orientation: 'portrait',
    icon: icon,
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageId
    },
    android: {
      package: packageId,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: icon, // Should ideally be a specific foreground PNG
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png'
      },
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-router',
      'expo-status-bar',
      'expo-secure-store',
      'expo-sharing',
      'expo-font',
      'expo-asset'
    ],
    splash: {
      image: splash,
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    extra: {
      API_URL: apiUrl,
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "your-eas-project-id"
      }
    }
  };
};
