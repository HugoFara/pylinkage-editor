/**
 * Screenshot script for Chebyshev linkage - canvas focused
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://127.0.0.1:8000';

async function takeScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Select Chebyshev example
    console.log('Loading Chebyshev example...');
    const selectLocator = page.locator('select');
    await selectLocator.selectOption('chebyshev');
    await page.waitForTimeout(500);

    // Click Load Example button
    const loadButton = page.locator('button', { hasText: 'Load Example' });
    await loadButton.click();
    await page.waitForTimeout(2000);

    // Run Simulation
    console.log('Running simulation...');
    const simButton = page.locator('button', { hasText: 'Run Simulation' });
    await simButton.click();
    await page.waitForTimeout(3000);

    // Play animation to build full path
    console.log('Playing animation...');
    const playButton = page.locator('button', { hasText: 'Play' });
    await playButton.click();
    await page.waitForTimeout(10000);

    // Stop animation
    const stopButton = page.locator('button', { hasText: 'Stop' });
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }
    await page.waitForTimeout(300);

    // Move slider to show coupler_midpoint at bottom of its path (straight-line portion)
    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible()) {
      await slider.fill('1');  // Start of animation shows mechanism clearly
      await page.waitForTimeout(500);
    }

    // Take full screenshot
    console.log('Taking full screenshot...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '05_chebyshev_straight_line.png'),
      fullPage: false
    });

    // Also take a canvas-focused crop
    console.log('Taking canvas-focused screenshot...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '06_chebyshev_canvas.png'),
      clip: { x: 300, y: 100, width: 900, height: 700 }
    });

    console.log('Screenshots saved!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshot();
