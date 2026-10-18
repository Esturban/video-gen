import assert from "node:assert/strict";
import test from "node:test";
import { browserFor, DESKTOP_CHROME } from "./browser.mjs";

const yes = () => true;
const no = () => false;

test("default is desktop Chrome when installed", () => {
  assert.equal(browserFor({}, yes), DESKTOP_CHROME);
});

test("default falls back to the pinned shell when desktop Chrome is missing", () => {
  assert.equal(browserFor({}, no), null);
});

test("a scene can force the pinned shell even with desktop Chrome installed", () => {
  assert.equal(browserFor({ browser: "headless-shell" }, yes), null);
});

test("an unknown browser name fails loudly", () => {
  assert.throws(() => browserFor({ browser: "firefox" }, yes), /must be one of/);
});
