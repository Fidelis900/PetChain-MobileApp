# Push Notification Deep Linking Implementation

## Overview

This feature implements deep linking for push notifications in the PetChain mobile app. When users tap a notification (medication reminder, appointment alert, SOS acknowledgment), they are directed directly to the relevant screen with the correct context pre-loaded.

## Features

- ✅ **Type-based routing**: Automatic route mapping based on notification type
- ✅ **Entity ID context**: Pre-loads specific medication, appointment, vaccination, or SOS records
- ✅ **Cold-start handling**: Works when app is not running
- ✅ **Background handling**: Works when app is in background
- ✅ **Fallback behavior**: Gracefully handles unknown notification types
- ✅ **Comprehensive tests**: Full integration test coverage

## Supported Notification Types

### 1. Medication Reminders
- **Route**: `Medications`
- **Parameters**: `medicationId`
- **Deep Link**: `petchain://medications?medicationId={id}`

### 2. Appointment Alerts
- **Route**: `Appointments`
- **Parameters**: `appointmentId`
- **Deep Link**: `petchain://appointments?appointmentId={id}`

### 3. Vaccination Alerts
- **Route**: `Vaccinations`
- **Parameters**: `vaccinationId`, `petId`, `dueDate`
- **Deep Link**: `petchain://vaccinations?vaccinationId={id}&petId={petId}&dueDate={date}`

### 4. SOS/Emergency Alerts
- **Route**: `Emergency`
- **Parameters**: `sosId`
- **Deep Link**: `petchain://emergency?sosId={id}`

## Implementation Details

### Core Files Modified

#### 1. **src/services/notificationService.ts**
- Added `NotificationDeepLink` interface for deep link parameters
- Added `DeepLinkParams` interface for route and params
- Extended `NotificationGroup` type to include `'sos'`
- Added `extractDeepLinkParams()` function to map notification data to navigation routes
- Enhanced `getNotificationUrl()` to generate proper deep links for all notification types

**Key Function:**
```typescript
export const extractDeepLinkParams = (
  data: Record<string, unknown>,
): { route: string; params: Record<string, any> } | null
```

This function:
- Extracts notification type and entity IDs from notification data
- Maps to appropriate navigation route
- Returns route name and params for navigation
- Supports fallback behavior for unknown types

#### 2. **src/navigation/AppNavigator.tsx**
- Added `Notifications` import from `expo-notifications`
- Created `navigationRef` export for external access
- Added `handleNotificationDeepLink()` function to navigate based on notification
- Added listener for `addNotificationResponseReceivedListener` to handle taps
- Updated deep linking config to support query parameters for entity IDs

**Key Changes:**
- Deep link routes now support optional parameters:
  - `medications/:medicationId?`
  - `appointments/:appointmentId?`
  - `vaccinations/:vaccinationId?`
  - `emergency/:sosId?`

#### 3. **src/navigation/types.ts**
- Updated `MainTabParamList` to include optional params for all main screens
- Enables type-safe navigation with entity IDs

#### 4. **App.tsx**
- Added `expo-notifications` import
- Imported `handleNotificationDeepLink` from AppNavigator
- Added cold-start notification handling via `getLastNotificationResponseAsync()`
- Checks for initial notification when app becomes ready

**Cold-Start Flow:**
```typescript
// On app launch, check if we came from a notification
const notification = await Notifications.getLastNotificationResponseAsync();
if (notification) {
  handleNotificationDeepLink(notification.notification.request.content.data);
}
```

### Navigation Flow

#### When User Taps Notification (Foreground/Background)
1. `expo-notifications` fires `addNotificationResponseReceivedListener`
2. `handleNotificationDeepLink()` is called with notification data
3. `extractDeepLinkParams()` maps data to route + params
4. `navigationRef.navigate()` directs to the appropriate screen

#### When App Launches from Notification (Cold-Start)
1. App initializes and becomes ready
2. `getLastNotificationResponseAsync()` retrieves the tap event
3. `handleNotificationDeepLink()` navigates to appropriate screen
4. User sees the relevant content immediately

### Data Structure

Notification data should include:
```typescript
{
  type: 'medication' | 'appointment' | 'vaccination' | 'sos',
  medicationId?: string,        // For medication reminders
  appointmentId?: string,       // For appointment alerts
  vaccinationId?: string,       // For vaccination alerts
  petId?: string,               // Pet context (vaccination, SOS)
  sosId?: string,               // For SOS alerts
  dueDate?: string,             // For vaccination (ISO date)
  leadDays?: number,            // For vaccination context
  category?: NotificationCategory,
  // ... other notification fields
}
```

## Testing

### Test Files

1. **src/services/__tests__/notificationDeepLinking.test.ts**
   - Tests `extractDeepLinkParams()` function
   - 40+ test cases covering:
     - All notification types
     - Parameter extraction
     - Fallback behavior
     - Edge cases and special characters
     - Real-world scenarios

2. **src/services/__tests__/notificationDeepLinkingURLs.test.ts**
   - Tests URL generation and encoding
   - Query parameter handling
   - Special character encoding

3. **src/navigation/__tests__/notificationDeepLinking.integration.test.ts**
   - End-to-end integration tests
   - Cold-start scenarios
   - Background scenarios
   - Parameter passing
   - Error resilience
   - Real-world user journeys

### Running Tests

```bash
# Run all notification deep linking tests
npm test -- notificationDeepLinking

# Run specific test file
npm test -- src/services/__tests__/notificationDeepLinking.test.ts

# Run with coverage
npm test -- notificationDeepLinking --coverage
```

## Usage Examples

### Scheduling a Medication Reminder with Deep Linking

```typescript
import { scheduleMedicationReminder } from './src/services/notificationService';

const medication = {
  id: 'med-penicillin-001',
  name: 'Penicillin',
  dosage: '500mg',
  frequency: 8,
  startDate: new Date().toISOString(),
};

await scheduleMedicationReminder(medication);
// When user taps: navigates to Medications screen with medicationId param
```

### Scheduling an Appointment Reminder

```typescript
import { scheduleAppointmentNotification } from './src/services/notificationService';

const appointment = {
  id: 'apt-vet-001',
  title: 'Annual Checkup',
  date: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  location: 'Sunshine Vet Clinic',
};

await scheduleAppointmentNotification(appointment);
// When user taps: navigates to Appointments screen with appointmentId param
```

### Sending an Emergency Alert

```typescript
import { sendAlertNotification } from './src/services/notificationService';

await sendAlertNotification(
  '🆘 Emergency Alert',
  'SOS signal received',
  {
    type: 'sos',
    sosId: 'sos-2026-05-29-001',
    category: 'health',
  }
);
// When user taps: navigates to Emergency screen with sosId param
```

## Deep Link Mappings

| Notification Type | Route | URL Pattern | Query Params |
|------------------|-------|-----------|--------------|
| Medication | Medications | `petchain://medications` | `?medicationId={id}` |
| Appointment | Appointments | `petchain://appointments` | `?appointmentId={id}` |
| Vaccination | Vaccinations | `petchain://vaccinations` | `?vaccinationId={id}&petId={id}&dueDate={date}` |
| SOS/Emergency | Emergency | `petchain://emergency` | `?sosId={id}` |

## Fallback Behavior

The system implements intelligent fallback handling:

1. **With Entity ID**: Navigates directly to the specific record
2. **Without Entity ID but with type**: Navigates to the category screen
3. **With petId but no type**: Falls back to PetDetail screen
4. **Unknown type**: Returns null (no navigation)

## Error Handling

- Gracefully handles malformed notification data
- Returns null for unrecognized notification types
- Preserves app state if navigation fails
- Logs navigation errors for debugging

## Performance Considerations

- Lazy evaluation of deep links
- Minimal overhead on notification reception
- No blocking operations during navigation
- Reference-based navigation (no unnecessary object creation)

## Security Considerations

- All IDs are validated before use
- URL encoding prevents injection attacks
- Navigation is only triggered from trusted notification sources
- No sensitive data in URLs

## Browser Testing

To test deep links in browser:

```typescript
// Test URL generation
const testUrl = 'petchain://medications?medicationId=med-123';

// React Navigation will parse and route correctly
```

## Future Enhancements

- [ ] Support for push notification action buttons
- [ ] Analytics tracking for notification taps
- [ ] Notification history/archive
- [ ] User preferences for notification handling
- [ ] Rich notifications with images/custom actions

## Troubleshooting

### Notification tap not working
1. Verify notification data includes `type` field
2. Check that entity ID field names match expected format
3. Ensure `navigationRef` is properly initialized
4. Review console logs for navigation errors

### Wrong screen opening
1. Verify `extractDeepLinkParams()` returns correct route
2. Check notification data structure
3. Ensure deep link config matches route names
4. Verify app navigation state is ready

### Cold-start not working
1. Ensure `Notifications.getLastNotificationResponseAsync()` is called after app ready
2. Check that notification response is not null
3. Verify `handleNotificationDeepLink()` is exported and called

## Related Documentation

- [Notification Service](./README.md)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
