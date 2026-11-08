import { test, expect } from "@playwright/test";

test("home page shows Live Collaboration Whiteboard", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2000);
  await expect(page.locator("text=Live Collaboration Whiteboard").first()).toBeVisible();
});

test("create room opens Excalidraw canvas", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[placeholder="Your name"]', "Tester");
  await page.click('button:has-text("Create room")');
  await page.waitForURL(/room=/, { timeout: 15000 });
  await page.waitForSelector("canvas", { timeout: 15000 });
  const hasApi = await page.evaluate(() => typeof (window as any).excalidrawAPI?.getSceneElements === "function");
  expect(hasApi).toBe(true);
});

test("programmatic rectangle renders at proper size (not tiny)", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[placeholder="Your name"]', "Tester");
  await page.click('button:has-text("Create room")');
  await page.waitForURL(/room=/, { timeout: 15000 });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const api = (window as any).excalidrawAPI;
    api.updateScene({ elements: [{ id: "r1", type: "rectangle", x: 100, y: 100, width: 300, height: 200, angle: 0, strokeColor: "#000", backgroundColor: "transparent", fillStyle: "hachure", strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, locked: false, link: null, boundElements: null }] });
  });
  await page.waitForTimeout(1000);
  const el = await page.evaluate(() => (window as any).excalidrawAPI?.getSceneElements()?.[0]);
  console.log("ELEMENT SIZE", el?.width, el?.height);
  expect(el).toBeTruthy();
  expect(el.width).toBeGreaterThan(50);
  expect(el.height).toBeGreaterThan(50);
  const canvasCount = await page.locator("canvas").count();
  console.log("CANVAS COUNT", canvasCount);
  expect(canvasCount).toBeGreaterThan(0);
});
