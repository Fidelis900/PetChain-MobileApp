import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Onboarding & Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { detoxSeed: 'test' } });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows the onboarding screen on first launch', async () => {
    await detoxExpect(element(by.id('onboarding-screen'))).toBeVisible();
  });

  it('navigates through onboarding slides', async () => {
    await element(by.id('onboarding-next-button')).tap();
    await element(by.id('onboarding-next-button')).tap();
    await element(by.id('onboarding-get-started-button')).tap();
  });

  it('shows the registration screen', async () => {
    await detoxExpect(element(by.id('register-screen'))).toBeVisible();
  });

  it('registers a new user', async () => {
    await element(by.id('register-name-input')).typeText('Test User');
    await element(by.id('register-email-input')).typeText('testuser@petchain.test');
    await element(by.id('register-password-input')).typeText('TestPass123!');
    await element(by.id('register-submit-button')).tap();

    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('logs out and logs back in', async () => {
    await element(by.id('settings-tab')).tap();
    await element(by.id('logout-button')).tap();

    await detoxExpect(element(by.id('login-screen'))).toBeVisible();

    await element(by.id('login-email-input')).typeText('testuser@petchain.test');
    await element(by.id('login-password-input')).typeText('TestPass123!');
    await element(by.id('login-submit-button')).tap();

    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
