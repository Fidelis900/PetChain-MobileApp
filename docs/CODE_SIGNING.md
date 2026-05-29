# Code Signing Setup

This document describes how to configure code signing for iOS and Android builds in GitHub Actions.

---

## Android

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` or `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the key alias |

### Generating a Keystore

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias <KEY_ALIAS> \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Encoding the Keystore

```bash
base64 -i release.keystore | pbcopy   # macOS — copies to clipboard
base64 release.keystore               # Linux — print to stdout
```

Paste the output as the `ANDROID_KEYSTORE_BASE64` secret.

### Configuring `android/app/build.gradle`

Add the following signing config (values are injected via environment variables by the workflow):

```groovy
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

---

## iOS

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `IOS_CERTIFICATE_BASE64` | Base64-encoded `.p12` distribution certificate |
| `IOS_CERTIFICATE_PASSWORD` | Password for the `.p12` certificate |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded `.mobileprovision` file |
| `IOS_PROVISIONING_PROFILE_NAME` | Name of the provisioning profile (as shown in Apple Developer portal) |
| `IOS_BUNDLE_ID` | App bundle identifier (e.g. `com.petchain.mobileapp`) |
| `KEYCHAIN_PASSWORD` | Any strong password — used for the temporary CI keychain |

### Obtaining the Certificate

1. In Xcode or Apple Developer portal, create an **iOS Distribution** certificate.
2. Export it as a `.p12` file with a password.
3. Encode it:

```bash
base64 -i certificate.p12 | pbcopy   # macOS
```

### Obtaining the Provisioning Profile

1. In Apple Developer portal, create an **App Store** provisioning profile for your bundle ID.
2. Download the `.mobileprovision` file.
3. Encode it:

```bash
base64 -i profile.mobileprovision | pbcopy   # macOS
```

### Adding Secrets to GitHub

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add each secret listed above.

---

## Workflows

| Workflow | Trigger | Output |
|---|---|---|
| `.github/workflows/android-signing.yml` | Push to `main`/`master` or manual | Signed `.aab` artifact |
| `.github/workflows/ios-signing.yml` | Push to `main`/`master` or manual | Signed `.ipa` artifact |

Both workflows can also be triggered manually via **Actions → Run workflow** in the GitHub UI.
