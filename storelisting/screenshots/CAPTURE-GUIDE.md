# Screenshot Capture Guide for App Store & Google Play

## Required Screenshots

### iOS App Store
**Minimum:** 5 screenshots  
**Recommended:** 10 screenshots (5 iPhone 6.7", 5 iPhone 5.5")

**Sizes:**
- iPhone 6.7" (iPhone 14 Pro Max): 1290 × 2796 pixels (portrait)
- iPhone 6.5" (iPhone 11 Pro Max): 1242 × 2688 pixels (optional)
- iPhone 5.5" (iPhone 8 Plus): 1242 × 2208 pixels (optional)

**Tip:** Upload 6.7" screenshots and Apple will automatically downsample for smaller devices.

### Google Play Store
**Minimum:** 2 screenshots  
**Recommended:** 8 screenshots

**Sizes:**
- Phone: 1080 × 1920 pixels (minimum width 320px, max 3840px)
- 7" Tablet: 1200 × 1920 pixels (at least 1 required for tablet support)
- 10" Tablet: recommended but not required

**Tip:** You can upload different screenshots for each device type.

---

## Screenshot Capture Steps

### Method 1: Using Expo Go (Quick & Easy)
1. Build and run the app in Expo Go on a physical device (better quality than simulator)
2. Navigate to each screen you want to capture
3. Use device screenshot function:
   - **iOS:** Press Side Button + Volume Up
   - **Android:** Press Power + Volume Down
4. Transfer images to computer via AirDrop, email, or USB
5. Crop to exact dimensions using an image editor

### Method 2: Simulator/Emulator Screenshots
1. Run the app in iOS Simulator or Android Emulator
2. Use built-in screenshot tools:
   - **iOS Simulator:** `Command + S` or menu → Device → Take Screenshot
   - **Android Emulator:** `Control + S` (Windows/Linux) or `Command + S` (Mac)
3. Screenshots save to desktop or specified folder
4. Crop to required dimensions

### Method 3: Expo EAS Build + Fastlane Snapshot (Automated)
For high-quality, consistent screenshots across locales:
```bash
# Install fastlane
brew install fastlane

# Navigate to project
cd PetChain-MobileApp

# Setup fastlane for screenshots
fastlane init

# Configure snapshot for iOS and Android
# See: https://docs.fastlane.tools/actions/snapshot/
```
Advanced; recommended for production releases.

---

## Screenshot Content Checklist

Capture the following screens (in order):

**1. Onboarding / Welcome**
- App logo splash screen (if available)
- Language selection screen
- Permissions request screens (Camera, Notifications) — say "Yes" to show permission grant UI

**2. Login / Register**
- Login form with email/password fields
- Register form with fields
- Social login buttons (Google, Apple, Facebook) if implemented
- "Forgot Password" screen

**3. Pet Dashboard (Home)**
- Overview of all pets (if multi-pet)
- Health scores displayed prominently
- Today's medications (upcoming)
- Upcoming appointments count
- Quick action buttons (Add Pet, Scan QR, SOS)

**4. Pet Detail Screen**
- Single pet profile with photo
- Pet info (name, breed, DOB, weight)
- Vital signs card
- Recent activity feed
- Action buttons: Records, Medications, Appointments, Share

**5. Medical Records Viewer**
- List of medical records (vaccinations, illnesses, surgeries)
- Record detail view with full notes
- Blockchain verification badge or indicator (if visible)
- PDF export button

**6. Medication Tracker**
- Medication list with next dose times
- Medication detail screen showing schedule
- Pill icon or reminder notification preview
- "Mark as given" checkbox or button

**7. Appointment Manager**
- Calendar or list view of appointments
- Appointment detail screen with vet clinic info
- Map/directions button
- Add appointment form

**8. QR Scanner**
- Live camera view with QR scanning overlay
- Scanned pet profile preview screen
- "View Full Profile" CTA

**9. Emergency SOS**
- Emergency contacts list screen
- SOS button prominent (maybe on home screen?)
- SOS confirmation/alert screen
- Contact notification screenshot (optional, hard to capture)

**10. Settings / Profile**
- Settings screen with options (Notifications, Language, Privacy Policy link)
- Profile screen with user info
- Data Export option
- Premium upgrade button (if applicable)

**11. Community (if applicable)**
- Community feed / social posts
- Create post screen
- Comments section

**12. Dark Mode (if supported)**
- Capture 1–2 screens in dark mode to show theme support (if implemented)

---

## Design & Editing Guidelines

### Before Editing
1. Capture screens at **maximum brightness**
2. Use **actual device** (not simulator) for best quality
3. Hide notifications during capture (Do Not Disturb mode)
4. Use **real data** (not test/placeholder data) to show authentic UI
5. Consider portrait mode only (most apps are vertical)

### After Capturing — Add Overlay Text

**Recommended text overlay style:**
- Large, bold headline at top (36–48pt)
- Secondary description subtitle (18–24pt)
- PetChain brand color (#4A90A4 or #2C5F6E) for text
- Optional: subtle drop shadow for readability
- Position text to avoid covering important UI elements

**Headline ideas:**
- "All medical records in one place"
- "Never miss a medication dose"
- "Share pet profiles instantly"
- "Emergency SOS at your fingertips"
- "Blockchain-secured & tamper-proof"
- "Works offline, anywhere"
- "Multi-pet support included"

**Tools for adding overlays:**
- **Canva** (free, templates for app store screenshots)
- **Figma** (if you have access)
- **Sketch** (Mac only)
- **Adobe Photoshop** / **Affinity Photo**
- **Preview** (Mac built-in) or **MS Paint** (Windows) for basic text

**Example overlay layout:**
```
[Top 15% of image — semi-transparent black overlay for contrast]
[Headline text — white, centered]
[Subtitle text — light gray, smaller]
[Bottom 10% — optional call-to-action: "Download on the App Store"]
```

**Do NOT:**
- Misrepresent the UI (don't Photoshop in fake features)
- Use misleading screenshots (review teams may reject)
- Include personal information of real people (blur names/emails if test data)
- Add excessive text that obscures the app content

---

## Asset Export Settings

- **Format:** PNG or JPEG (PNG for lossless quality, JPEG may be smaller)
- **Color Profile:** sRGB (standard)
- **Compression:** Maximum quality, minimal compression
- **File naming convention:**
  - `iPhone-14ProMax-Onboarding.png`
  - `iPhone-14ProMax-Dashboard.png`
  - `Android-Phone-Medicines.png`
  - `Android-Phone-QRScanner.png`

---

## Platform-Specific Notes

### iOS App Store
- No device frames required, but recommended for brand consistency
- Apple does NOT allow promotional text layered on top of screenshots for the primary set (you can add in the description, but not on images themselves)
- Show **actual app UI only** — text overlays may be rejected in some locales
- Better to use clean screenshots without overlay text; use description field to highlight features
- You CAN add marketing text in a separate promotional screenshot slot (optional additional screenshots)

**Recommended approach for iOS:**
- Upload 5 clean screenshots (no overlays)
- Then optionally add up to 5 more with promotional text/callouts

### Google Play Store
- Allows text overlays and device frames
- Show feature graphic at the top of your store listing (1024×500px)
- Can include short headline on each screenshot
- Upload screenshots in **portrait orientation only** (no landscape required)

---

## Additional Assets

### Feature Graphic (Google Play Only)
- **Size:** 1024 × 500 pixels (JPEG or 24-bit PNG, no alpha)
- **Purpose:** Promotional banner at top of Google Play listing
- **Content:** App logo, tagline, optional character or pet imagery
- **Do NOT include:** "Download now" button (Google forbids CTA)

### Promo Video (Optional)
- **iOS App Preview:** 15–30 seconds, .mov or .mp4, 1920×1080
- **Google Play Promo Video:** YouTube link, landscape preferred
- Show key features in action: QR scan, medication reminder, SOS button

### App Icon (Promotional)
- **Size:** 1024×1024px (already in assets/)
- No rounded corners; store applies mask

---

## Final Checklist

Before uploading to store:

- [ ] All screenshots are correct dimensions (no stretching)
- [ ] No sensitive/personal data visible in screenshots
- [ ] Use real app data (not mock/placeholder)
- [ ] Consistent visual style across all screenshots (same filter, overlay style)
- [ ] Text overlays are legible on small screens
- [ ] Screenshots accurately reflect current app version (no features that were removed)
- [ ] File sizes are reasonable (<5MB each, ideally <2MB)
- [ ] Filenames are organized for easy upload
- [ ] Test on actual device that screenshots look good on store page

---

Once you have the screenshots ready, place them in:

```
storelisting/screenshots/ios/
storelisting/screenshots/android/
```

And reference them in App Store Connect / Google Play Console during listing creation.
