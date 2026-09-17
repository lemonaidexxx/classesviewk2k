import { expect, test } from '@playwright/test';
test('column preferences persist and calendar shares filters and opens details', async ({
  page,
}, info) => {
  await page.goto('/preview');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.getByText('Better visibility. Better decisions.')).toHaveCount(0);
  await page.locator('.column-picker summary').click();
  await page.getByRole('checkbox', { name: 'Province', exact: true }).uncheck();
  await expect(page.getByRole('columnheader', { name: 'Province', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('columnheader', { name: 'Province', exact: true })).toHaveCount(0);
  await page.locator('.column-picker summary').click();
  await page.getByRole('button', { name: 'Show all columns' }).click();
  await expect(page.getByRole('columnheader', { name: 'Province', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Calendar view', exact: true }).click();
  await page.getByRole('combobox', { name: 'Categories', exact: true }).selectOption('AI');
  await expect(page.locator('.metric-value').first()).toHaveText('8');
  await expect(page.locator('.course-event')).toHaveCount(8);
  await page.locator('.course-event').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('status')).toContainText('No courses');
  await page.getByRole('button', { name: 'This month' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: `artifacts/${info.project.name}-calendar.png`, fullPage: true });
});
test('dashboard needs no sign-in and missing source config is explicit', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Connection setup required')).toBeVisible();
  const response = await request.get('/api/dashboard');
  expect(response.status()).toBe(503);
  expect((await response.json()).classes).toBeUndefined();
  await page.goto('/preview');
  await expect(page.getByText(/Synthetic sample data/)).toBeVisible();
});
test('filters, details, keyboard focus, and reset work', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('.metric-value').first()).toContainText('17');
  await page.getByRole('combobox', { name: 'Categories' }).selectOption('AI');
  await expect(page.locator('.metric-value').first()).toHaveText(/8/);
  const first = page.locator('.course-button').first();
  await first.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Schedule & milestones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close class details' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: /View source row/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(first).toBeFocused();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.metric-value').first()).toContainText('17');
  await page.getByRole('textbox', { name: 'Search classes' }).fill('not-a-course');
  await expect(page.getByText('No classes match this view')).toBeVisible();
});
test('responsive layout and footer do not shift or block content', async ({ page }, info) => {
  await page.goto('/preview');
  await page.getByRole('heading', { name: 'Executive class overview.' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  const before = await footer.boundingBox();
  if (info.project.name === 'desktop' && before) {
    await page.mouse.move(before.x + before.width * 0.8, before.y + before.height * 0.6);
    await expect
      .poll(async () => footer.evaluate((el) => el.style.getPropertyValue('--pointer-x')))
      .not.toBe('');
    expect(await footer.boundingBox()).toEqual(before);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (before) await page.mouse.move(before.x + 10, before.y + 10);
  await expect(footer).toHaveCSS('--pointer-x', '50%');
  expect(await footer.boundingBox()).toEqual(before);
  await page.screenshot({ path: `artifacts/${info.project.name}-dashboard.png`, fullPage: true });
});
