/**
 * Screenshot script for pylinkage web app
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://127.0.0.1:8000';

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Screenshot 1: Empty state (already done)
    console.log('Screenshot 1: Empty state');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01_empty_state.png'),
      fullPage: false
    });

    // Load an example
    console.log('Loading example...');
    const selectLocator = page.locator('select');
    await selectLocator.click();
    await page.waitForTimeout(500);

    // Get options
    const options = await selectLocator.locator('option').all();
    console.log(`Found ${options.length} options`);

    // Select the second option (first is "Select an example...")
    if (options.length > 1) {
      const optionValue = await options[1].getAttribute('value');
      console.log(`Selecting: ${optionValue}`);
      await selectLocator.selectOption(optionValue);
      await page.waitForTimeout(500);

      // Click Load Example button
      const loadButton = page.locator('button', { hasText: 'Load Example' });
      await loadButton.click();
      await page.waitForTimeout(2000);

      // Screenshot 2: With loaded example
      console.log('Screenshot 2: With example loaded');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '02_fourbar_example.png'),
        fullPage: false
      });

      // Click Run Simulation
      const simButton = page.locator('button', { hasText: 'Run Simulation' });
      if (await simButton.isVisible()) {
        console.log('Running simulation...');
        await simButton.click();
        await page.waitForTimeout(3000);

        // Screenshot 3: After simulation
        console.log('Screenshot 3: After simulation');
        await page.screenshot({
          path: path.join(OUTPUT_DIR, '03_with_simulation.png'),
          fullPage: false
        });

        // Click Play to animate
        const playButton = page.locator('button', { hasText: 'Play' });
        if (await playButton.isVisible()) {
          await playButton.click();
          await page.waitForTimeout(1500);

          // Screenshot 4: During animation
          console.log('Screenshot 4: During animation');
          await page.screenshot({
            path: path.join(OUTPUT_DIR, '04_animation_frame.png'),
            fullPage: false
          });
        }
      }
    }

    // Try another example if available
    console.log('Trying another example...');
    if (options.length > 2) {
      const optionValue = await options[2].getAttribute('value');
      console.log(`Selecting: ${optionValue}`);
      await selectLocator.selectOption(optionValue);
      await page.waitForTimeout(500);

      const loadButton = page.locator('button', { hasText: 'Load Example' });
      await loadButton.click();
      await page.waitForTimeout(2000);

      // Run simulation
      const simButton = page.locator('button', { hasText: 'Run Simulation' });
      if (await simButton.isVisible()) {
        await simButton.click();
        await page.waitForTimeout(3000);
      }

      // Screenshot 5: Second example
      console.log('Screenshot 5: Second example');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '05_second_example.png'),
        fullPage: false
      });
    }

    console.log('Screenshots saved to:', OUTPUT_DIR);
  } catch (error) {
    console.error('Error:', error.message);
    // Save error screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'error_state.png'),
      fullPage: false
    });
  } finally {
    await browser.close();
  }
}

takeScreenshots();
