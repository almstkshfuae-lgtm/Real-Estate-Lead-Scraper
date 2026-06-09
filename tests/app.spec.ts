import { test, expect } from '@playwright/test';

test('app root redirects to login page', async ({ page }) => {
  await page.goto('/');

  // Should land on /login (auth wall)
  await expect(page).toHaveURL(/\/login/);

  // Login page should render the email input
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  await expect(emailInput).toBeVisible();
});

test('login page has correct title', async ({ page }) => {
  await page.goto('/login');

  // Page title should reference the app name
  await expect(page).toHaveTitle(/Brilliance|LeadPulse|Lead/i);
});
