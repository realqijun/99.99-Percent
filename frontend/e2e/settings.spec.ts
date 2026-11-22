/* Settings persist across reloads, and muting really silences the game. */
import type { FrameLocator, Page } from "@playwright/test";
import { expect, openGame, reopenGame, test } from "./support";

/** Keeps every AudioContext the game makes, so the test can see whether sound is running. */
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    if (!Original) return;
    const made: AudioContext[] = [];
    (window as unknown as { audioContexts: AudioContext[] }).audioContexts = made;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        made.push(this);
      }
    };
  });
}

const audioState = (page: Page) =>
  page.frames()[1].evaluate(() => (window as unknown as { audioContexts: AudioContext[] }).audioContexts.map((c) => c.state).join());

const settings = (game: FrameLocator) => game.getByRole("dialog", { name: "Settings" });

test("settings persist across a reload, and mute silences the game", async ({ page }) => {
  await watchAudio(page);
  let game = await openGame(page);

  await game.getByRole("button", { name: "Settings" }).click();
  const dialog = settings(game);
  const music = dialog.getByRole("slider", { name: "Music" });
  await expect(music).toHaveValue("60");
  // The first press starts the audio.
  await expect.poll(() => audioState(page)).toBe("running");

  await music.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
  await expect(music).toHaveValue("40");
  await expect(dialog.getByText("40%")).toBeVisible();
  // The speed radios are drawn as a segmented control; arrow keys move between them.
  await dialog.getByRole("radio", { name: "Normal" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Fast" })).toBeChecked();
  await dialog.getByRole("checkbox", { name: "Reduce motion" }).check();
  await dialog.getByRole("checkbox", { name: "Mute all" }).check();
  await expect(music).toBeDisabled();
  await expect(dialog.getByRole("slider", { name: "Sound effects" })).toBeDisabled();
  // With nothing to hear, the audio goes to sleep.
  await expect.poll(() => audioState(page), { timeout: 6000 }).toBe("suspended");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  game = await reopenGame(page);
  await game.getByRole("button", { name: "Settings" }).click();
  await expect(settings(game).getByRole("checkbox", { name: "Mute all" })).toBeChecked();
  await expect(settings(game).getByRole("slider", { name: "Music" })).toHaveValue("40");
  await expect(settings(game).getByRole("radio", { name: "Fast" })).toBeChecked();
  await expect(settings(game).getByRole("checkbox", { name: "Reduce motion" })).toBeChecked();
  await expect(game.locator(".stage")).toHaveAttribute("data-motion", "reduced");

  // Unmuting wakes the audio again.
  await settings(game).getByRole("checkbox", { name: "Mute all" }).uncheck();
  await expect.poll(() => audioState(page)).toBe("running");
  await expect(settings(game).getByRole("slider", { name: "Music" })).toBeEnabled();
});
