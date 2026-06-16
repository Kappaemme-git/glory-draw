// Captures real screens from the live Glory Draw site into ./public/screens
// Uses the system Google Chrome via puppeteer-core (no large download).
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/screens');
const URL = process.env.SITE_URL || 'https://glory-draw.vercel.app/';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Click a button whose visible text matches (case-insensitive contains).
async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, t) => {
      const els = Array.from(document.querySelectorAll(sel));
      return els.find((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase())) || null;
    },
    selector,
    text
  );
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(OUT, name) });
  console.log('captured', name);
}

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1366, height: 854, deviceScaleFactor: 2 },
    args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();

  try {
    // 1) HOME
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.start-btn', { timeout: 30000 });
    await sleep(1200); // let entrance animations settle
    await shot(page, 'home.png');

    // 2) DRAFT — enter the game and roll a squad
    await clickByText(page, 'button', 'Play');
    await sleep(800);
    await clickByText(page, '.roll-panel button', 'Roll');
    await page.waitForSelector('.player-list', { timeout: 15000 });
    await sleep(900);
    await shot(page, 'draft.png');

    // 3) PICK — select the first available player (highlights eligible slots)
    const picked = await page.evaluate(() => {
      const row = document.querySelector('.player-row:not(.unavailable)');
      if (row) {
        row.click();
        return true;
      }
      return false;
    });
    if (picked) {
      await sleep(700);
      await shot(page, 'pick.png');
    }

    // 4) RESULT — fresh load, auto-draft a full XI, simulate, skip to the end
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.auto-btn', { timeout: 30000 });
    await clickByText(page, 'button', 'Random XI');
    await page.waitForSelector('.pitch', { timeout: 15000 });
    await sleep(1000);

    const simulated = await clickByText(page, 'button', 'Simulate World Cup');
    if (simulated) {
      await page.waitForSelector('.live-panel', { timeout: 15000 });
      await sleep(1500);
      // capture a live match frame
      await shot(page, 'live.png');

      // go to 2x, then keep skipping match-by-match until the FINAL card shows
      // (.result-hero is always present; it loses the .pending class when finished)
      await clickByText(page, '.sim-controls button', '2x');
      let done = false;
      for (let i = 0; i < 80; i++) {
        const finished = await page.$('.result-hero:not(.pending)');
        if (finished) {
          done = true;
          break;
        }
        await clickByText(page, '.sim-controls button', 'Skip to match result');
        await sleep(450);
      }
      if (done) {
        await sleep(1200);
        await shot(page, 'result.png');
      } else {
        console.warn('final result not reached; keeping live frame only');
      }
    }
  } catch (err) {
    console.error('capture error:', err.message);
  } finally {
    await browser.close();
  }
};

main();
