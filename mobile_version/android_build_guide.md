# 🤖 Android APK Native Build Guide

This guide details how to build a native Android APK (`.apk` file) for your Fantasy Cricket Grand Manager game that can be directly installed and run on any Android phone.

---

## 🛠️ Method 1: Cloud Build via Expo Application Services (Recommended)
This is the easiest and most reliable method. It compiles the app on Expo's cloud servers, meaning you **do not need** to install the Android SDK or Java Development Kit (JDK) on your local computer.

### Step 1: Install EAS CLI
Install the Expo Application Services (EAS) command-line interface globally:
```bash
npm install -g eas-cli
```

### Step 2: Log in / Create an Expo Account
Log in with your Expo credentials (or register a free account at [expo.dev](https://expo.dev)):
```bash
npx eas login
```

### Step 3: Configure Project
Initialize the EAS configuration inside the `mobile_version/` folder:
```bash
npx eas build:configure
```
*This command creates an `eas.json` file in your root folder.*

### Step 4: Configure for APK Output (Instead of AAB)
By default, EAS builds `.aab` files (for Google Play Store submission). To build an installable `.apk` file:
1. Open the newly generated `eas.json`.
2. Add a `preview` profile with `developmentClient: false` and `buildType: "apk"` under the `build` section. Your `eas.json` should look like this:
```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

### Step 5: Start the Build
Trigger the Android APK build:
```bash
npx eas build --platform android --profile preview
```
* Once completed, the CLI will output a QR code and a download link. Scan the QR code with your phone to download and install the `.apk` file directly!

---

## 💻 Method 2: Local Compilation (Android SDK & JDK Required)
If you have Java (JDK 17+) and the Android SDK fully configured on your Linux machine, you can compile the APK locally.

### Step 1: Generate Native Android Directory
Run Expo Prebuild to generate the native `/android` folder:
```bash
npx expo prebuild --platform android
```

### Step 2: Compile Debug APK
Navigate to the generated Android folder and compile using the Gradle wrapper:
```bash
cd android
./gradlew assembleDebug
```

### Step 3: Locate your APK
Once the compile finishes, your installable debug APK will be generated at:
`mobile_version/android/app/build/outputs/apk/debug/app-debug.apk`

Copy this file to your Android phone via USB, email, or cloud storage, tap it on your phone, and select **Install**!
