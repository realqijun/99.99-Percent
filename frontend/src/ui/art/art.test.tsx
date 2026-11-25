import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ICONS } from "./icons";
import { ArtGallery, Icon, ICON_NAMES, Sprite, SPRITE_NAMES } from "./index";
import { PALETTE } from "./palette";
import { PLACEHOLDER, SPRITES } from "./sprites";

const ENEMY_SPRITES = [
  "trafficSpike", "slowQuery", "botCrawler", "memoryLeak", "coldStart", "logFlood", "thunderingHerd", "lockContention", "launchDay",
  "cacheStampede", "retryStorm", "noisyNeighbor", "connectionLeak", "hotPartition", "flakyDeploy", "ddosBotnet", "splitBrain", "blackFriday",
  "cascadingFailure", "certExpiry", "dnsOutage", "clockSkew", "zombieProcess", "configGhost", "dataCorruption", "legacyMonolith", "regionOutage",
  "shopperWave", "failingZone",
];

function render(el: ReactElement): SVGSVGElement {
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(el), "text/html");
  return doc.querySelector("svg")!;
}

function expectGrid(rows: readonly string[], size: number) {
  expect(rows).toHaveLength(size);
  for (const row of rows) {
    expect(row).toHaveLength(size);
    for (const ch of row) if (ch !== ".") expect(PALETTE, `colour "${ch}"`).toHaveProperty(ch);
  }
}

describe("art data", () => {
  it("draws every enemy, and only those", () => {
    expect([...SPRITE_NAMES].sort()).toEqual([...ENEMY_SPRITES].sort());
  });

  it.each(Object.entries(SPRITES))("sprite %s is 32x32 in the palette", (_, rows) => expectGrid(rows, 32));

  it("placeholder is 32x32 in the palette", () => expectGrid(PLACEHOLDER, 32));

  it.each(Object.entries(ICONS))("icon %s is 16x16 in the palette", (_, rows) => expectGrid(rows, 16));

  it("keeps the palette small and well formed", () => {
    const colours = Object.entries(PALETTE);
    expect(colours.length).toBeLessThanOrEqual(24);
    for (const [ch, hex] of colours) {
      expect(ch).toMatch(/^[a-z]$/);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("Sprite", () => {
  it("renders a labelled image of merged runs", () => {
    const svg = render(<Sprite name="launchDay" size={64} label="Launch Day" />);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Launch Day");
    expect(render(<Sprite name="launchDay" />).getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    const runs = SPRITES.launchDay.reduce((n, row) => n + row.replace(/(.)\1*/g, "$1").replace(/\./g, "").length, 0);
    expect(svg.querySelectorAll("rect")).toHaveLength(runs);
  });

  it("draws the placeholder for unknown names", () => {
    const unknown = render(<Sprite name="noSuchEnemy" label="Mystery" />);
    const placeholder = render(<Sprite name="toString" label="Mystery" />);
    expect(unknown.getAttribute("aria-label")).toBe("Mystery");
    expect(unknown.innerHTML).toBe(placeholder.innerHTML);
    expect(unknown.innerHTML).not.toBe(render(<Sprite name="trafficSpike" label="Mystery" />).innerHTML);
    expect(unknown.querySelectorAll("rect").length).toBeGreaterThan(0);
  });
});

describe("Icon", () => {
  it("is decorative without a label", () => {
    const svg = render(<Icon name="budget" />);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.hasAttribute("aria-label")).toBe(false);
    expect(svg.getAttribute("width")).toBe("16");
  });

  it("is an image with a label", () => {
    const svg = render(<Icon name="cash" size={48} label="Cash" />);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Cash");
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
    expect(svg.getAttribute("width")).toBe("48");
  });
});

it("ArtGallery shows every sprite and icon by name", () => {
  const html = renderToStaticMarkup(<ArtGallery />);
  for (const name of [...SPRITE_NAMES, ...ICON_NAMES]) expect(html).toContain(`>${name}</figcaption>`);
});
