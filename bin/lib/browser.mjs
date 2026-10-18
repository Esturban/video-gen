// REUSE_CHECKED: none   browser choice was an inline line in bin/video; pulled out so it can be tested (CMO-8248)
// Which Chrome renders a scene. Default: EV's desktop Chrome when installed, else Remotion's pinned Chrome Headless Shell.
// A scene sets "browser": "headless-shell" to force the pinned shell: desktop Chrome sometimes captures a frame before it is fully
// painted on heavy svg pages (blank, half-painted or 3x3 tiled frames; diagnosed in DEV-7364 on the Riyadh Lab thank-you film,
// 16 bad frames with desktop Chrome, 0 with the shell). Run `node_modules/.bin/remotion browser ensure` once to download it.
export const DESKTOP_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const BROWSERS = ["desktop", "headless-shell"];

/** Path for Remotion's browserExecutable, or null to let Remotion use its own Headless Shell. */
export const browserFor = (scene, exists) => {
  const want = scene?.browser ?? "desktop";
  if (!BROWSERS.includes(want)) throw new Error(`scene "browser" must be one of ${BROWSERS.join(", ")}, got ${JSON.stringify(want)}`);
  if (want === "headless-shell") return null;
  return exists(DESKTOP_CHROME) ? DESKTOP_CHROME : null;
};
