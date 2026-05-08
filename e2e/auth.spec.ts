import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) =>
      console.log('\uD83C\uDF10 BROWSER:', msg.type(), msg.text())
    );
    page.on('pageerror', (error) =>
      console.log('\u274C BROWSER CRASH:', error.message)
    );
    page.on('requestfailed', (request) =>
      console.log('\u26A0\uFE0F BROWSER NETWORK FAIL:', request.url(), request.failure()?.errorText)
    );
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    // Wait for the login form to be visible
    await expect(page.getByPlaceholder('Correo electrónico')).toBeVisible();
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByPlaceholder('Correo electrónico').fill('test@example.com');
    await page.getByPlaceholder('Contraseña').fill('wrongpassword');

    // Click login button
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Wait for error state (loading then error)
    await expect(page.getByText(/error|incorrecto|fallido/i)).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/');

    // Should be redirected to login
    await expect(page).toHaveURL(/.*login.*/);
    await expect(page.getByPlaceholder('Correo electrónico')).toBeVisible();
  });
});
