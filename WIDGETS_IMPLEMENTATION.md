# PetChain Home Screen Widgets

This implementation adds iOS WidgetKit and Android App Widget support to the PetChain mobile app. Widgets display today's medication schedule, upcoming appointments, and pet health scores directly on the home screen.

## Features

- **iOS WidgetKit Integration**: Native widgets for iOS 14+ using WidgetKit framework
- **Android App Widget**: Native widgets for Android 5.0+
- **Multiple Widget Sizes**: Support for small, medium, and large widget layouts
- **Real-time Updates**: Widgets update automatically on app foreground and notification receipt
- **Deep Linking**: Tap widget items to navigate to relevant app screens
- **Data Sharing**: Secure data sharing between main app and widget extensions via app groups (iOS) and shared preferences (Android)

## Architecture

### File Structure

```
PetChain-MobileApp/
├── src/
│   └── services/
│       └── widgetService.ts          # Main widget service logic
├── ios-widget/
│   ├── PetChainWidget.swift          # WidgetKit implementation
│   └── PetChainWidgetModule.swift    # iOS native bridge
├── android-widget/
│   ├── PetChainWidgetProvider.java   # Android widget provider
│   ├── PetChainWidgetModule.java     # Android native module
│   ├── widget_provider.xml           # Widget configuration
│   └── widget_layout_small.xml       # Widget UI layouts
├── App.tsx                           # App entry point (updated)
├── app.config.js                     # Expo config (updated)
└── expoWidgetPlugin.js              # Expo plugin configuration
```

### Data Flow

```
┌─────────────────────┐
│   React Native      │
│   App (App.tsx)     │
└──────────┬──────────┘
           │
           ├─► widgetService.ts (fetches data)
           │   ├─► medicationService.getMedications()
           │   ├─► appointmentService.getUpcomingAppointments()
           │   └─► healthMetricService.getHealthMetrics()
           │
           └─► Native Bridge
               ├─► iOS: PetChainWidgetModule
               │   └─► UserDefaults (app groups)
               │       └─► WidgetKit (refresh timeline)
               │
               └─► Android: PetChainWidgetModule
                   └─► SharedPreferences
                       └─► BroadcastReceiver (update widget)
```

## Widget Data Structure

### WidgetData (TypeScript)

```typescript
interface WidgetData {
  medications: MedicationScheduleItem[];      // Today's medications
  appointments: UpcomingAppointmentItem[];    // Next 5 appointments
  healthScores: PetHealthScore[];             // All pets' health scores
  lastUpdated: string;                        // ISO timestamp
  timestamp: number;                          // Milliseconds since epoch
}
```

### MedicationScheduleItem

- `id`: Unique identifier
- `medicationName`: Name of medication
- `dosage`: Dosage information
- `petName`: Pet receiving medication
- `frequency`: Hours between doses
- `taken`: Boolean indicating if taken today

### UpcomingAppointmentItem

- `id`: Appointment ID
- `title`: Appointment type/description
- `date`: Scheduled date (YYYY-MM-DD)
- `time`: Scheduled time (HH:MM)
- `petName`: Pet with appointment
- `vetName`: Veterinarian name
- `durationMinutes`: Appointment duration

### PetHealthScore

- `petId`: Pet identifier
- `petName`: Pet name
- `healthScore`: 0-100 score
- `lastUpdated`: Last update timestamp

## Setup Instructions

### 1. Install Dependencies

```bash
npm install expo-updates @sentry/react-native
# or
pnpm install
```

### 2. iOS Setup (WidgetKit)

The iOS WidgetKit extension will be automatically generated during `eas build`.

**Manual Setup (if building locally):**

1. Open Xcode project: `ios/PetChain.xcworkspace`
2. Create a new WidgetKit Target:
   - File → New → Target
   - Select "Widget Extension"
   - Name: `PetChainWidget`
3. Copy `ios-widget/PetChainWidget.swift` to the widget target
4. Configure app groups in both targets:
   - Signing & Capabilities → + Capability
   - Add "App Groups"
   - Set to `group.app.petchain.mobile`

### 3. Android Setup

The Android widget provider will be registered automatically during `eas build`.

**Manual Setup (if building locally):**

1. Copy `android-widget/` files to Android project:
   ```
   android/app/src/main/java/app/petchain/mobile/widget/
   ```

2. Create widget layout XML files in `res/layout/`:
   - `widget_layout_small.xml`
   - `widget_layout_medium.xml`
   - `widget_layout_large.xml`

3. Update `AndroidManifest.xml` to register receiver:
   ```xml
   <receiver android:name="app.petchain.mobile.widget.PetChainWidgetProvider">
     <intent-filter>
       <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
     </intent-filter>
     <meta-data android:name="android.appwidget.provider"
       android:resource="@xml/widget_provider" />
   </receiver>
   ```

4. Create `res/xml/widget_provider.xml`:
   ```xml
   <appwidget-provider>
     <!-- see widget_provider.xml in android-widget/ -->
   </appwidget-provider>
   ```

## Widget Update Flow

### On App Foreground

1. App comes to foreground
2. `initializeWidgetService()` listens to `AppState` changes
3. When state becomes `'active'`, `refreshWidgetData()` is called
4. Widget service fetches latest data from services
5. Data is stored in shared storage (app groups/shared preferences)
6. Native module triggers widget refresh

### On Notification Receipt

1. Notification is received (app in foreground or background)
2. Notification response handler checks notification type
3. If type is medication/appointment/health, `refreshWidgetData()` is called
4. Same flow as app foreground

### Manual Update

Call `forceWidgetUpdate()` to manually trigger widget refresh:

```typescript
import { forceWidgetUpdate } from './src/services/widgetService';

// Manually refresh widget data
await forceWidgetUpdate();
```

## Deep Linking from Widgets

When user taps a widget item, the widget can deep link to the app:

### iOS (WidgetKit)

```swift
Link(destination: URL(string: "petchain://medication/\(medicationId)")!) {
    Text(medication.name)
}
```

### Android

```java
Intent intent = new Intent(Intent.ACTION_VIEW);
intent.setData(Uri.parse("petchain://appointment/" + appointmentId));
context.startActivity(intent);
```

### App Navigation Handler

```typescript
// In navigation/AppNavigator.ts
export function handleNotificationDeepLink(data: NotificationDeepLink) {
  const { route, params } = widgetService.handleWidgetDeepLink(
    data.type,
    data.targetId
  );
  // Navigate to route with params
}
```

## Health Score Calculation

The health score is calculated based on recent health metrics:

- **Base score**: 100
- **Activity level penalties**:
  - Low activity: -20 points
  - Moderate activity: -10 points
  - High activity: No penalty
- **Temperature anomalies**: -15 points if outside normal range (37-39°C)
- **Final score**: Clamped between 0-100

Calculation considers metrics from the past 7 days.

## Performance Considerations

1. **Widget Update Frequency**: Limited to once per 5 minutes to save battery
2. **Data Caching**: Widget data is cached locally and persists across app restarts
3. **Background Refresh**: Widgets update on background fetch (iOS) and scheduled jobs (Android)
4. **Memory Usage**: Widget extensions run in separate processes with limited memory

## Testing

### Simulate Widget on iOS

1. Open Xcode with the PetChain workspace
2. Select the widget scheme
3. Run on simulator
4. Widget will appear in simulator's home screen

### Simulate Widget on Android

1. Build debug APK:
   ```bash
   ./gradlew assembleDebug
   ```
2. Install and add widget to home screen
3. Check `adb logcat` for logs

### Manual Testing

Use the widget service functions in development:

```typescript
// In App.tsx or debug screen
import widgetService from './src/services/widgetService';

// Test data refresh
await widgetService.refreshWidgetData();

// Get cached widget data
const cached = await widgetService.getWidgetDataFromCache();
console.log('Cached widget data:', cached);

// Force update
await widgetService.forceWidgetUpdate();
```

## Building for Production

### EAS Build

The widget will be automatically built with the app:

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Build both
eas build --platform all --profile production
```

The Expo plugin will handle:
- iOS: Creating WidgetKit target, configuring app groups
- Android: Registering widget provider, updating manifest

## Troubleshooting

### iOS Widget Not Updating

1. Check app groups configuration:
   - Both main app and widget target must have `group.app.petchain.mobile`
   - Verify in Xcode: Signing & Capabilities

2. Verify UserDefaults access:
   ```swift
   UserDefaults(suiteName: "group.app.petchain.mobile")?.set(data, forKey: "petchain_widget_data")
   ```

3. Check WidgetKit timeline:
   - Ensure `WidgetCenter.shared.reloadAllTimelines()` is called after data update

### Android Widget Not Updating

1. Verify SharedPreferences write:
   ```java
   SharedPreferences prefs = context.getSharedPreferences("PetChainWidgetPrefs", Context.MODE_PRIVATE);
   prefs.edit().putString("petchain_widget_data", data).apply();
   ```

2. Check BroadcastReceiver:
   - Verify receiver is registered in AndroidManifest.xml
   - Check `adb logcat` for receiver logs

3. Clear widget cache:
   ```bash
   adb shell pm clear app.petchain.mobile
   ```

## Future Enhancements

1. **Interactive Widgets**: Allow marking medications as taken directly from widget
2. **Dynamic Island Support**: iOS 16+ support for dynamic island notifications
3. **Glanceables**: iOS 17+ support for lock screen widgets
4. **Custom Styling**: Support for user-selectable widget themes
5. **Smart Stack**: Group related widgets together
6. **Complications**: watchOS support for Apple Watch

## References

- [Apple WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit/)
- [Android App Widgets Documentation](https://developer.android.com/guide/topics/appwidgets)
- [Expo Plugins Documentation](https://docs.expo.dev/plugins/introduction/)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)

## Contributing

When modifying widget code:

1. Update both iOS and Android implementations for feature parity
2. Test on physical devices (widgets behave differently in simulators)
3. Verify data sharing between app and widget works correctly
4. Update this documentation with any changes

## License

MIT - See LICENSE file for details
