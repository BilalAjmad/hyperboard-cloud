import { test, expect } from "@playwright/test";

test("comprehensive verification", async ({ page }) => {
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  // 1. Home page - check title and branding
  await page.goto("/");
  await page.waitForTimeout(2000);
  const homeText = await page.locator("body").innerText();
  console.log("HOME HAS EXCALIDRAW:", /Excalidraw/i.test(homeText));
  console.log("HOME HAS LIVE:", /Live Collaboration Whiteboard/i.test(homeText));
  await expect(page.locator("text=Live Collaboration Whiteboard").first()).toBeVisible();

  // 2. Create room with auto code
  await page.fill('input[placeholder="Your name"]', "Tester");
  await page.click('button:has-text("Create room")');
  await page.waitForURL(/room=/, { timeout: 15000 });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Check share panel shows room code and user
  const sharePanel = page.locator("text=Room:");
  await expect(sharePanel).toBeVisible();
  const roomCode = await page.locator("text=Room:").textContent();
  console.log("SHARE PANEL ROOM CODE:", roomCode);
  
  // Check user list
  const userCount = await page.locator("text=online").textContent();
  console.log("USER COUNT:", userCount);

  // 3. API key panel should NOT be visible initially
  const apiKeyVisible = await page.locator("text=Text-to-Diagram API Key").count();
  console.log("API KEY VISIBLE (before TTD):", apiKeyVisible);

  // 4. Click text-to-diagram - should show API key panel
  await page.keyboard.press("t"); // text tool
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter"); // open TTD dialog? Actually TTD is a separate button
  await page.waitForTimeout(1000);
  
  // Try to find TTD button and click it
  const ttdButton = page.locator('[aria-label*="Text to diagram" i], [data-testid*="text-to-diagram" i], button:has-text("Text to diagram")').first();
  if (await ttdButton.count() > 0) {
    await ttdButton.click();
    await page.waitForTimeout(2000);
    const apiKeyAfter = await page.locator("text=Text-to-Diagram API Key").count();
    console.log("API KEY VISIBLE (after TTD):", apiKeyAfter);
  } else {
    console.log("TTD button not found via standard selectors");
  }

// Check for Excalidraw branding
  const bodyText = await page.locator("body").innerText();
  console.log("EXCALIDRAW MENTIONS:", (bodyText.match(/Excalidraw/gi) || []).length);
  console.log("TITLE:", await page.title());
});
