import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { Command } from "../../engine/types";
import { gameStore } from "../../game/store";
import { FIXTURE_CONTENT, FIXTURES } from "../__fixtures__";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let sent: Command[];

function show(fixture: string) {
  const f = FIXTURES[fixture];
  gameStore.getState().loadFixture(structuredClone(f.run), f.trail);
  sent = [];
  gameStore.setState({
    dispatch: vi.fn((cmd: Command) => {
      sent.push(cmd);
      return true;
    }),
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<App content={FIXTURE_CONTENT} />));
}

const button = (name: string | RegExp) => {
  const all = [...host.querySelectorAll("button")];
  const found = all.find((b) => {
    const label = b.getAttribute("aria-label") ?? b.textContent ?? "";
    return typeof name === "string" ? label === name : name.test(label);
  });
  if (!found) throw new Error(`No button ${name}`);
  return found;
};
const click = (el: Element) => act(() => (el as HTMLElement).click());
const key = (k: string, opts: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts })));
const hand = () => {
  const screen = gameStore.getState().run!.screen;
  return screen.kind === "combat" ? screen.combat.hand : [];
};

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("combat", () => {
  it("plays a targeted card on the enemy clicked after it", () => {
    show("combat");
    const card = button(/^1: Serve/);
    click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(sent).toEqual([]);
    click(button(/^Target Bot Swarm/));
    expect(sent).toEqual([{ type: "playCard", uid: hand()[0].uid, target: 1 }]);
  });

  it("plays an untargeted card on a second click", () => {
    show("combat");
    click(button(/^3: Provision/));
    click(button(/^3: Provision/));
    expect(sent).toEqual([{ type: "playCard", uid: hand()[2].uid, target: undefined }]);
  });

  it("selects with number keys, cycles targets with arrows and plays with Enter", () => {
    show("combat-revealed");
    key("1");
    expect(button(/^1: Serve/).getAttribute("aria-pressed")).toBe("true");
    key("ArrowRight");
    key("Enter");
    expect(sent).toEqual([{ type: "playCard", uid: hand()[0].uid, target: 2 }]);
  });

  it("cancels with Escape and ends the turn with E", () => {
    show("combat");
    key("2");
    key("Escape");
    expect(button(/^2: Serve/).getAttribute("aria-pressed")).toBe("false");
    key("Enter");
    expect(sent).toEqual([]);
    key("e");
    expect(sent).toEqual([{ type: "endTurn" }]);
  });

  it("won't pick a card it can't play, and says why", () => {
    show("combat-low-budget");
    const burst = button(/^2: Burst Serve/);
    expect(burst.getAttribute("aria-disabled")).toBe("true");
    expect(burst.getAttribute("aria-label")).toContain("Not enough Engineers");
    click(burst);
    key("2");
    expect(burst.getAttribute("aria-pressed")).toBe("false");
  });

  it("sends the tutorial buttons' commands", () => {
    show("combat-tutorial-0");
    expect(host.textContent).toContain("This is your hand");
    click(button("Next"));
    click(button("Skip tutorial"));
    expect(sent).toEqual([{ type: "advanceTutorial" }, { type: "skipTutorial" }]);
  });

  it("answers a pending choice", () => {
    show("combat-pending");
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Choose a card to decommission");
    const confirm = button("Confirm");
    expect(confirm.disabled).toBe(true);
    click(dialog.querySelector(".card-btn")!);
    click(confirm);
    expect(sent).toEqual([{ type: "chooseCards", uids: [hand()[0].uid] }]);
    // Keys belong to the dialog while it is open.
    key("e");
    expect(sent).toHaveLength(1);
  });

  it("uses a targeted runbook from the top bar", () => {
    show("combat");
    click(button("Runbook: Kill Switch"));
    click(button("Use"));
    click(button(/^Target Bot Swarm/));
    expect(sent).toEqual([{ type: "useRunbook", slot: 1, target: 1 }]);
  });
});
