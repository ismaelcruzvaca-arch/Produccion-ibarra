import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) =>
      console.log('🌐 BROWSER:', msg.type(), msg.text())
    );
    page.on('pageerror', (error) =>
      console.log('❌ BROWSER CRASH:', error.message)
    );
    page.on('requestfailed', (request) =>
      console.log('⚠️ BROWSER NETWORK FAIL:', request.url(), request.failure()?.errorText)
    );
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    // Wait for the login form to be visible
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Tu contraseña')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible({ timeout: 10000 });
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');

    // Wait for inputs to be visible before interacting
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible({ timeout: 10000 });

    // Fill in invalid credentials
    await page.getByPlaceholder('tu@correo.com').fill('test@example.com');
    await page.getByPlaceholder('Tu contraseña').fill('wrongpassword');

    // Click login button
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Wait for error state (loading then error)
    await expect(page.getByText(/error|incorrecto|fallido/i)).toBeVisible({ timeout: 15000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/');

    // Should be redirected to login (AuthGuard uses setTimeout(0) for redirect)
    await expect(page).toHaveURL(/.*login.*/, { timeout: 10000 });
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible({ timeout: 10000 });
  });
});