import { expect, test } from '@playwright/test';

test('login renders separate EDO identity', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'EcoProgress EDO' })).toBeVisible();
  await page.screenshot({
    path: `screenshots/login-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('organization registration wizard is usable', async ({ page }, testInfo) => {
  await page.goto('/register/organization');
  await expect(page.getByRole('heading', { name: 'Новая организация' })).toBeVisible();
  await expect(page.getByLabel('Фамилия')).toBeVisible();
  await page.screenshot({
    path: `screenshots/registration-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('external signing does not render organization navigation', async ({ page }) => {
  await page.goto('/external-sign/invalid-test-token');
  await expect(page.getByText('EcoProgress EDO · Внешнее подписание')).toBeVisible();
  await expect(page.getByText('Сотрудники')).toHaveCount(0);
});
