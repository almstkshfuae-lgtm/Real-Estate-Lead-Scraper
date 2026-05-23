import { test, expect } from '@playwright/test';

test('application home page responds', async ({ page }) => {
  const response = await page.goto('/');
  await expect(response).not.toBeNull();
  await expect(response?.status()).toBeLessThan(400);
});
