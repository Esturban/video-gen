import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { CORNERS, SLOT_DEFAULTS, brandSlotState, resolveBrandSlot, slotContent, slotPlacement, slotScale } from "./brandSlotMath.js";
import { validateBrandSlotAssets } from "../bin/lib/checklist.mjs";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };
/** A real, valid 2x2 RGBA PNG built in memory: the fixture the logo branch is tested with (no real logo anywhere). */
export const tinyPng = () => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
  const row = Buffer.from([0, 36, 31, 26, 255, 36, 31, 26, 255]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat([row, row]))), chunk("IEND", Buffer.alloc(0))]);
};

const SPEC = { text: "Esteban V.", corner: "bottom-right", logo: null };

test("resolve fills defaults and keeps the text", () => {
  const s = resolveBrandSlot(SPEC);
  assert.equal(s.text, "Esteban V.");
  assert.equal(s.corner, "bottom-right");
  assert.equal(s.fadeStart, SLOT_DEFAULTS.fadeStart);
  assert.deepEqual(slotContent(s), { kind: "text", text: "Esteban V." });
});

test("resolve rejects bad input with the field named", () => {
  assert.throws(() => resolveBrandSlot(null), /must be an object/);
  assert.throws(() => resolveBrandSlot({ text: "x", corner: "middle" }), /corner "middle"/);
  assert.throws(() => resolveBrandSlot({ corner: "top-left" }), /needs text, or a logo/);
  assert.throws(() => resolveBrandSlot({ text: "x", margin: -4 }), /margin/);
  assert.throws(() => resolveBrandSlot({ text: "x", opacity: 2 }), /opacity/);
  assert.throws(() => resolveBrandSlot({ logo: "https://x.test/a.png" }), /relative path/);
  assert.throws(() => resolveBrandSlot({ logo: "../secret.png" }), /inside assets/);
  assert.throws(() => resolveBrandSlot({ logo: 5 }), /null or a path/);
});

test("a logo path switches the content to the image and wins over text", () => {
  const s = resolveBrandSlot({ ...SPEC, logo: "brand/mark.png" });
  assert.deepEqual(slotContent(s), { kind: "logo", src: "brand/mark.png" });
});

test("hidden for the first second, then in: opacity and reveal rise monotonically and settle", () => {
  const s = resolveBrandSlot(SPEC);
  assert.deepEqual(brandSlotState(0, s), { reveal: 0, opacity: 0 });
  assert.deepEqual(brandSlotState(1, s), { reveal: 0, opacity: 0 });
  let last = brandSlotState(1, s);
  for (let t = 1; t <= 4; t += 1 / 60) {
    const now = brandSlotState(t, s);
    assert.ok(now.reveal >= last.reveal && now.opacity >= last.opacity - 1e-12, `fell at ${t}`);
    last = now;
  }
  const done = brandSlotState(99, s);
  assert.equal(done.reveal, 1);
  assert.ok(Math.abs(done.opacity - SLOT_DEFAULTS.opacity) < 1e-12, "rests at the low-key opacity");
  assert.ok(done.opacity < 0.7, "subtle");
});

test("placement keeps a safe margin in every corner and scales with the canvas", () => {
  for (const c of CORNERS) {
    const p = slotPlacement(c, 64, 1440, 1440);
    assert.equal(Object.keys(p).length, 2);
    assert.ok(Object.values(p).every((v) => v === 64));
  }
  assert.deepEqual(slotPlacement("bottom-right", 64, 1440, 1440), { right: 64, bottom: 64 });
  assert.deepEqual(slotPlacement("top-left", 64, 720, 720), { left: 32, top: 32 });
  assert.equal(slotScale(1920, 1080), 0.75);
});

test("the logo fixture is a real PNG and the check names the file when it is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "slot-"));
  const png = tinyPng();
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual(validateBrandSlotAssets(dir, { ...SPEC, logo: "mark.png" }), [`brandSlot.logo "mark.png" is not in ${join(dir, "assets")}`]);
});

test("with a generated PNG in assets/ the logo check passes; a non-PNG named .png fails", async () => {
  const { mkdirSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "slot-"));
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "assets", "mark.png"), tinyPng());
  writeFileSync(join(dir, "assets", "fake.png"), "not a png");
  assert.deepEqual(validateBrandSlotAssets(dir, { ...SPEC, logo: "mark.png" }), []);
  assert.match(validateBrandSlotAssets(dir, { ...SPEC, logo: "fake.png" })[0], /not a valid PNG/);
  assert.deepEqual(validateBrandSlotAssets(dir, SPEC), []);
  assert.equal(readFileSync(join(dir, "assets", "mark.png")).length, tinyPng().length);
});
