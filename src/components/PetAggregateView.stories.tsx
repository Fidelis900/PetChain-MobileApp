import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';

import PetAggregateView from './PetAggregateView';

/**
 * `PetAggregateView` — A summary card grid showing all pets in an account
 * with quick-access stats and a pet selector.
 *
 * Each pet card displays:
 * - Species emoji
 * - Name
 * - Species & breed
 * - Active indicator dot (green) for the currently selected pet
 *
 * ### Props
 * | Prop | Type | Default | Description |
 * |------|------|---------|-------------|
 * | `onSelectPet` | `(pet: Pet) => void` | — | Callback when a pet card is tapped |
 *
 * ### Usage
 * ```tsx
 * <PetAggregateView onSelectPet={(pet) => setActivePet(pet)} />
 * ```
 *
 * > **Note:** Requires `PetContext`. Wrap with a mock `PetProvider` in Storybook.
 */
const meta: Meta<typeof PetAggregateView> = {
  title: 'Components/PetAggregateView',
  component: PetAggregateView,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#f5f5f5' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PetAggregateView>;

export const Default: Story = {
  args: {
    onSelectPet: action('onSelectPet'),
  },
};
