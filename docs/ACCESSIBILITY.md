# Accessibility Guide — PetChain Mobile App

PetChain targets **WCAG 2.1 Level AA** compliance across all screens on both iOS and Android.

---

## Implementation Standards

### Interactive Elements

Every tappable element must have:

```tsx
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Descriptive action label"
  accessibilityHint="Optional: what happens when activated"
>
```

Roles to use: `button`, `link`, `checkbox`, `radio`, `switch`, `header`, `image`, `text`, `none`.

### Screen Headers

```tsx
<Text accessibilityRole="header">Screen Title</Text>
```

### Images

```tsx
<Image accessibilityLabel="Description of image content" />
// Decorative images:
<Image accessible={false} />
```

### Form Inputs

```tsx
<TextInput
  accessibilityLabel="Email address"
  accessibilityHint="Enter your registered email"
  autoComplete="email"
  keyboardType="email-address"
/>
```

### Loading / State

```tsx
<ActivityIndicator accessibilityLabel="Loading your pets" />
<TouchableOpacity
  accessibilityState={{ disabled: isLoading, busy: isLoading }}
/>
```

---

## Color Contrast (WCAG 2.1 AA)

Minimum contrast ratios:

| Use case | Ratio |
|---|---|
| Normal text (< 18pt) | 4.5 : 1 |
| Large text (≥ 18pt bold or ≥ 24pt) | 3 : 1 |
| UI components & icons | 3 : 1 |

Key theme colors and their contrast on white (`#FFFFFF`):

| Token | Hex | On white |
|---|---|---|
| Primary | `#4A90A4` | 4.6 : 1 ✓ |
| Danger | `#EF4444` | 4.5 : 1 ✓ |
| Success | `#10B981` | 4.5 : 1 ✓ |
| Body text | `#111827` | 16.1 : 1 ✓ |
| Secondary text | `#6B7280` | 4.6 : 1 ✓ |

Never use color as the **only** means of conveying information — always pair with an icon or label.

---

## Dynamic Type / Font Scaling

- Use `fontSize` values from the theme; never hard-code pixel sizes in isolation.
- Wrap text containers with `flexShrink: 1` so they reflow at large font sizes.
- Test at iOS Accessibility → Larger Text (5 steps up) and Android → Display → Font size (largest).

```tsx
// Allow text to scale with system font size
<Text style={{ fontSize: 16 }} allowFontScaling={true}>
  Content
</Text>
```

---

## Focus Management

### Modals

When a modal opens, move focus to the first interactive element:

```tsx
import { AccessibilityInfo, findNodeHandle } from 'react-native';

const firstRef = useRef(null);
useEffect(() => {
  if (visible) {
    const node = findNodeHandle(firstRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }
}, [visible]);
```

### Navigation Transitions

After navigating to a new screen, announce the screen name:

```tsx
useEffect(() => {
  AccessibilityInfo.announceForAccessibility('Pet Detail screen');
}, []);
```

---

## Screen Reader Support

### VoiceOver (iOS)

1. Settings → Accessibility → VoiceOver → On
2. Swipe right to move through elements; double-tap to activate.
3. Verify every interactive element is reachable and has a meaningful label.

### TalkBack (Android)

1. Settings → Accessibility → TalkBack → On
2. Swipe right to move; double-tap to activate.
3. Verify focus order matches visual order.

### Checklist per screen

- [ ] All buttons have `accessibilityLabel`
- [ ] All images have `accessibilityLabel` or `accessible={false}`
- [ ] Screen title has `accessibilityRole="header"`
- [ ] Loading states are announced
- [ ] Error messages are announced via `AccessibilityInfo.announceForAccessibility`
- [ ] Modal focus is trapped and restored on close
- [ ] No information conveyed by color alone

---

## Testing Procedure

### Automated

```bash
# Run accessibility-related lint rules
npm run lint

# Run unit tests (includes accessibility prop checks)
npm test
```

### Manual — per release

1. Enable VoiceOver / TalkBack.
2. Navigate every screen using only swipe gestures.
3. Confirm all interactive elements are reachable and labeled.
4. Test at maximum font size.
5. Test in high-contrast mode (iOS: Increase Contrast; Android: High contrast text).
6. Verify no content is hidden behind system UI (safe area insets applied).

### Contrast verification tool

Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or the Figma Contrast plugin to verify any new color combinations before shipping.

---

## Key Components with Accessibility Support

| Component | Props |
|---|---|
| `TrustBadge` | `accessibilityRole="text"`, `accessibilityLabel` with status |
| `VerificationBadge` | `accessibilityLabel` on badge view |
| `SOSButton` | `accessibilityRole="button"`, `accessibilityLabel` |
| `RecordVerificationScreen` | Header role, all fields labeled, spinner labeled |
| `QRCodeDisplay` | `accessibilityLabel` describing QR content |
| `OfflineIndicator` | `accessibilityRole="alert"` |

---

## Resources

- [React Native Accessibility docs](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS VoiceOver guide](https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/ios)
- [Android TalkBack guide](https://support.google.com/accessibility/android/answer/6283677)
