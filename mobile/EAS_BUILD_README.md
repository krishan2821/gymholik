# Gymholik EAS Build Guide

This project is configured to use Expo Application Services (EAS) to build standalone Android APKs natively in the cloud. It utilizes a dynamic `app.config.js` to change the App Name, Package ID, and API URL based on the build profile you select.

## Prerequisites

1. Create an Expo account at [expo.dev](https://expo.dev) if you haven't already.
2. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
3. Login to your Expo account:
   ```bash
   eas login
   ```
4. Configure the project by linking it (run inside the `mobile/` directory):
   ```bash
   eas init
   ```
   *(This will automatically inject your real EAS Project ID into `app.config.js` or `eas.json`)*

## Build Profiles

We have configured two profiles in `eas.json` for APK generation:
- **`preview`**: Builds an APK named "Gymholik Preview" connected to `https://preview-api.gymholik.com`.
- **`production`**: Builds an APK named "Gymholik" connected to `https://api.gymholik.com`.

## Commands to Build

Run the following commands inside the `mobile/` directory.

### Build Preview APK
```bash
eas build --platform android --profile preview
```

### Build Production APK
```bash
eas build --platform android --profile production
```

## Downloading and Installing

Once the build is finished, EAS CLI will output a direct link to download the `.apk` file (and a QR code you can scan on your Android device).

To install directly to a connected Android device or running emulator via ADB, simply run:
```bash
# EAS CLI can automatically download and install it for you if an emulator is running
eas build:run -p android --profile preview

# OR manually if you downloaded the APK
adb install path/to/downloaded/gymholik-build.apk
```
