// "@video/kinds" is aliased per scene to that scene's kinds.tsx (bin/lib/webpack-override.mjs).
declare module "@video/kinds" {
  import type React from "react";
  export const KINDS: Record<string, React.FC>;
}

// Font files imported by engine parts (the brand slot signature) resolve to a URL string through the bundler's font rule.
declare module "*.ttf" {
  const url: string;
  export default url;
}
