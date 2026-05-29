# Storybook Setup — PetChain Mobile

This document explains how to install, run, and extend the PetChain component
library documentation powered by **Storybook for React Native**.

---

## Installation

Install the required Storybook packages:

```bash
npx storybook@latest init --type react_native
```

Or install manually:

```bash
npm install --save-dev @storybook/react-native \
  @storybook/addon-ondevice-controls \
  @storybook/addon-ondevice-actions \
  @storybook/addon-ondevice-notes \
  @storybook/addon-ondevice-backgrounds \
  @storybook/addon-actions \
  @storybook/blocks \
  babel-plugin-react-native-web
```

Then generate the loader file:

```bash
npx sb-rn-get-stories
```

This writes `.storybook/storybook.requires.js` which auto-imports all `*.stories.*` files.

---

## Running Storybook

### On-device (Expo)

1. Set `STORYBOOK_ENABLED=true` in your `.env.development` file.
2. Update `App.tsx` to conditionally render Storybook:

```tsx
// App.tsx
import StorybookUI from './.storybook';

const isStorybookEnabled = process.env.STORYBOOK_ENABLED === 'true';

export default isStorybookEnabled ? StorybookUI : AppRoot;
```

3. Start the Expo dev server:

```bash
npm start
```

4. Open the app on your simulator or device — Storybook UI will load.

### Web (optional)

```bash
npx storybook dev -p 6006
```

---

## Project Structure

```
.storybook/
  main.js          # Story glob patterns and addons
  preview.js       # Global decorators and parameters
  index.js         # Storybook UI entry point
  storybook.requires.js  # Auto-generated — do not edit manually

src/components/
  *.stories.tsx    # One story file per component
  Introduction.stories.mdx  # Library overview page
```

---

## Writing Stories

Each component has a co-located `ComponentName.stories.tsx` file.

### Minimal example

```tsx
import type { Meta, StoryObj } from '@storybook/react-native';
import MyComponent from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
};
export default meta;

type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: { label: 'Hello' },
};
```

### Conventions

| Convention | Rule |
|------------|------|
| Title | `Components/<ComponentName>` |
| File location | Co-located with the component (`src/components/`) |
| Story names | PascalCase, descriptive (`Default`, `ErrorState`, `Compact`) |
| Decorators | Wrap with `<View style={{ padding: 24 }}>` for spacing |
| Actions | Use `action('handlerName')` from `@storybook/addon-actions` |
| Controls | Declare `argTypes` for interactive knobs |

---

## Documented Components

| Component | Story file | Stories |
|-----------|-----------|---------|
| `EmergencyCallButton` | `EmergencyCallButton.stories.tsx` | Default, NumberOnly, Compact, SkipConfirm |
| `ErrorBoundary` | `ErrorBoundary.stories.tsx` | WithChildren, ErrorFallback |
| `MetricBarChart` | `MetricBarChart.stories.tsx` | WeightTrend, HeartRate, SinglePoint, Empty |
| `OfflineIndicator` | `OfflineIndicator.stories.tsx` | Default, OfflineState, SyncingState, PendingState |
| `OptimizedImage` | `OptimizedImage.stories.tsx` | Default, AvatarSize, ErrorState |
| `PermissionRationaleModal` | `PermissionRationaleModal.stories.tsx` | Camera, Location, OpenSettings, Hidden |
| `PetAggregateView` | `PetAggregateView.stories.tsx` | Default |
| `PetPhotoUploader` | `PetPhotoUploader.stories.tsx` | Empty, WithPhoto |
| `PetSelectorBar` | `PetSelectorBar.stories.tsx` | WithAddButton, WithoutAddButton |
| `RetryError` | `RetryError.stories.tsx` | FirstFailure, SecondAttempt, MaxRetriesReached |
| `SecureView` | `SecureView.stories.tsx` | Default, WithSensitiveContent |
| `SOSButton` | `SOSButton.stories.tsx` | Default, FullWidth |
| `VerificationBadge` | `VerificationBadge.stories.tsx` | Verified, Failed, Pending, Unknown, AllStates |

---

## Regenerating the Story Loader

Whenever you add a new `*.stories.*` file, regenerate the loader:

```bash
npx sb-rn-get-stories
```

Or add it as a script in `package.json`:

```json
"storybook:generate": "sb-rn-get-stories"
```

---

## Addons

| Addon | Purpose |
|-------|---------|
| `addon-ondevice-controls` | Live prop editing via Controls panel |
| `addon-ondevice-actions` | Logs callback invocations |
| `addon-ondevice-notes` | Inline documentation notes |
| `addon-ondevice-backgrounds` | Switch background colour |
