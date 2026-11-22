import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('validate, compare, filter and format', async ({ page }) => {
  await page.goto('./');
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');
  await page.getByRole('link', { name: 'Open the workspace' }).first().click();
  await expect(page.getByTestId('total')).toHaveText('10');

  await page.getByLabel('Changed', { exact: true }).fill('{"order": "A-1", "status": "shipped",}');
  await expect(page.getByText(/Line 1, column/)).toBeVisible();
  await page.getByLabel('Changed', { exact: true }).fill('{"order":"A-1","status":"shipped","total":12}');
  await page.getByLabel('Original', { exact: true }).fill('{"order":"A-1","status":"processing"}');
  await expect(page.getByTestId('total')).toHaveText('2');
  await page.getByRole('button', { name: 'Format' }).nth(1).click();
  await expect(page.getByLabel('Changed', { exact: true })).toHaveValue(/\n  "order"/);
  await page.getByRole('button', { name: 'Load demo' }).click();
  await expect(page.getByTestId('total')).toHaveText('10');
  await page.getByRole('radio', { name: 'Type changed' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, 'compare');
  await checkMobile(page);
  await page.reload();
  await expect(page.getByTestId('total')).toHaveText('10');
});
