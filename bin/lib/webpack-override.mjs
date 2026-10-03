// Webpack wiring for one scene, shared by render, stills and studio. Nothing is written into the engine source:
//   @video/kinds   -> the scene's own kinds.tsx (engine/Video.tsx imports it)
//   @video/engine  -> this engine's engine/ folder (what a scene imports as "@video/engine/beat")
//   a relative ".../engine/beat" import, as scenes written inside the old kit have, is redirected to the same file
//   react and remotion resolve from this engine's one node_modules, even for a scene folder in another repo
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEGACY_ENGINE_IMPORT = /^(?:\.\.?\/)+engine\/beat(?:\.tsx?)?$/;

export const sceneWebpackOverride = (sceneDir) => (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@video/engine": join(KIT, "engine"), "@video/kinds": join(sceneDir, "kinds") },
    modules: [join(KIT, "node_modules"), "node_modules"],
  },
  plugins: [
    ...(config.plugins ?? []),
    new webpack.NormalModuleReplacementPlugin(LEGACY_ENGINE_IMPORT, (resource) => { resource.request = join(KIT, "engine", "beat"); }),
  ],
});
