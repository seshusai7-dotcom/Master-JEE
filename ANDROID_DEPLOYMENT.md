# Setup, Android APK Build & Google Play Store Deployment Guide

## Application
**MASTER JEE – Class 11 Physics**  
Created and Academically Directed by **Dr. V. Sesha Sai Kumar**, GRIET, Hyderabad.

## 1. Web & Server Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (`.env` / platform secrets):
   - `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser/Android APK).
3. Run locally:
   ```bash
   npm run dev
   ```
4. Production build & run:
   ```bash
   npm run build
   npm start
   ```

## 2. Building an Android APK via Capacitor
`capacitor.config.ts` is pre-configured with `appId: "in.ac.griet.masterjee.physics11"` and `webDir: "dist"`.
1. Install Capacitor packages:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   ```
2. Build web assets and sync to Android:
   ```bash
   npm run build
   npx cap add android
   npx cap sync android
   ```
3. Open in Android Studio:
   ```bash
   npx cap open android
   ```
4. Inside Android Studio:
   - Configure the backend API base URL (`https://your-production-server.run.app`) for `/api/tutor/chat` and `/api/questions/generate`.
   - Select **Build > Build Bundle(s) / APK(s) > Build APK(s)** for debug testing, or **Generate Signed Bundle / APK** for release distribution.

## 3. Google Play Store Deployment Checklist
1. Generate a signed release `.aab` (Android App Bundle) using a securely stored upload keystore (`keytool -genkey -v -keystore masterjee-release.keystore`).
2. Prepare Play Console store listing assets (App Title, Short & Full Description, Feature Graphic 1024×500, Phone & Tablet screenshots).
3. Complete the **App Content** declarations (Privacy Policy URL, Data Safety for Firebase Auth/Firestore user progress, Target Audience).
4. Upload `.aab` to **Internal Testing** track first, verify Firebase Google Sign-In SHA-1/SHA-256 fingerprints in Firebase Console, then promote to **Production**.
