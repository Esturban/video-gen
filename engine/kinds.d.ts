// "@video/kinds" is aliased per scene to that scene's kinds.tsx (bin/lib/webpack-override.mjs).
declare module "@video/kinds" {
  import type React from "react";
  export const KINDS: Record<string, React.FC>;
}
