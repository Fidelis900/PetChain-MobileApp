import * as StoreReview from 'expo-store-review';

import {
  engagementTracker,
  type EngagementEvent,
  NEGATIVE_EVENTS,
} from '../utils/engagementTracker';

const analytics = {
  track: (event: string, props?: object) => console.log('[analytics]', event, props),
};

export const reviewService = {
  async onEngagementEvent(event: EngagementEvent): Promise<void> {
    if (NEGATIVE_EVENTS.includes(event)) return;

    await engagementTracker.recordEvent(event);

    const eligible = await engagementTracker.isEligibleForPrompt();
    if (!eligible) return;

    const variant = await engagementTracker.getABVariant();
    if (variant === 'delayed') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return;

    analytics.track('review_prompt_shown', { variant, trigger: event });
    await engagementTracker.recordPromptShown();

    await StoreReview.requestReview();
    analytics.track('review_prompt_completed', { variant, trigger: event });
  },
};
