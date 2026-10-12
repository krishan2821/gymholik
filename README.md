# Gymholik Backend

This is the backend for the Gymholik application, structured to run efficiently and securely in a containerized environment.

## Running on Fedora

Fedora typically uses SELinux by default. The `docker-compose.yml` is already configured with the `:z` volume label on the MongoDB data volume, which tells the container engine to correctly label the volume for SELinux so the container can access it without permission denied errors.

### Prerequisites

Ensure you have Docker and Docker Compose installed.

```bash
# Install Docker and Docker Compose on Fedora
sudo dnf install -y docker docker-compose

# Enable and start the Docker daemon
sudo systemctl enable --now docker

# Optional: Add your user to the docker group so you don't need sudo
sudo usermod -aG docker $USER
newgrp docker
```

### Setup and Execution

1. **Configure Environment Variables**
   Copy the example environment file and customize the secrets:
   ```bash
   cp .env.example .env
   # Edit .env and change the secrets
   nano .env
   ```

2. **Build and Run**
   Launch the application stack in detached mode:
   ```bash
   docker-compose up -d --build
   ```

3. **Verify Health**
   You can monitor the health of the containers (especially MongoDB auth and the API):
   ```bash
   docker-compose ps
   ```
   *Note: Both containers have health checks configured. The API will not fully start until the MongoDB container is marked as healthy.*

4. **View Logs**
   ```bash
   docker-compose logs -f
   ```

## Security Features

- **Non-Root Execution:** The Spring Boot application is run as the `spring` non-root user.
- **Memory Limits:** The Java app uses `-XX:MaxRAMPercentage=75.0` to respect container boundaries, and Docker Compose enforces a hard `512M` limit.
- **Localhost Binding:** The API is securely bound to `127.0.0.1:8080`, meaning it's inaccessible from outside networks directly without a reverse proxy.
- **No Exposed Database:** MongoDB does not publish port `27017` to the host machine, closing off potential brute-force or unauthorized access vectors.
- **SELinux Compatibility:** The MongoDB volume enforces the `:z` label natively supporting Fedora SELinux policies.

---

# Gymholik Mobile App

React Native / Expo mobile app for Gymholik gym owners, staff, and members.

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Android SDK & Java 17/21 (for native Android builds)

### Development

```bash
cd mobile
npm install

# Start development server
npm run start

# Run on Web
npm run web

# Run on connected Android device (Native / Prebuild)
npm run android
```

### Standalone Android APK Build

To build the standalone release APK directly without Expo Go:

```bash
cd mobile

# Generate native Android project if not already generated
npx expo prebuild --platform android

# Assemble release APK (optimized for arm64-v8a or universal)
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

# Output APK location:
# mobile/android/app/build/outputs/apk/release/app-release.apk

# Install directly to connected device:
adb install -r app/build/outputs/apk/release/app-release.apk
```

