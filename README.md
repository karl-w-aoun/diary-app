# Daymark Diary

An offline-first personal diary for Android. Entries, moods, tags, search, and insights stay on the device through Capacitor Preferences.

## Local development

```bash
npm install
npm run dev
```

## Build an APK locally

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

## GitHub Actions

Push the `diary-app` folder to a GitHub repository. The workflow at `.github/workflows/build.yml` runs on pushes to `main` and manual dispatches, then uploads `daymark-diary-debug-apk` as a workflow artifact.
