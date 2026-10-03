// REUSE_CHECKED: 1_social/py/video-gen/engine/brandSlotMath.js (this round, pure maths) and the delayRender font loading pattern from content-thinking scenes/promo/motion-pieces/parts/fonts.ts (our own).
// Brand slot overlay: an "Esteban V." signature in a handwriting font (or a logo image) in one corner, low-key, faded in after the first second.
// Rendered by engine/Video.tsx only when scene.json has "brandSlot"; the font ships inside the engine, so a scene needs no font work.
import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useBrand } from "./beat";
import { brandSlotState, resolveBrandSlot, slotContent, slotPlacement, slotScale } from "./brandSlotMath.js";
import signatureFontUrl from "./assets/fonts/HerrVonMuellerhoff-Regular.ttf";

// Herr Von Muellerhoff, SIL Open Font License 1.1 (engine/assets/fonts/OFL-HerrVonMuellerhoff.txt).
export const SIGNATURE_FAMILY = "Herr Von Muellerhoff";
const FALLBACK = "'Snell Roundhand', 'Brush Script MT', cursive";

let fontPromise: Promise<void> | null = null;
const loadSignatureFont = () => {
  fontPromise ??= new FontFace(SIGNATURE_FAMILY, `url(${signatureFontUrl})`).load().then((face) => { document.fonts.add(face); });
  return fontPromise;
};

/** Holds the render until the signature font is in, so no frame is drawn in a fallback face. Only mounted when a slot is rendered. */
const useSignatureFont = (needed: boolean) => {
  const [handle] = useState(() => (needed ? delayRender(`Load ${SIGNATURE_FAMILY}`) : null));
  useEffect(() => {
    if (handle === null) return;
    loadSignatureFont().then(() => continueRender(handle)).catch((e) => cancelRender(e));
  }, [handle]);
};

export type BrandSlotSpec = { text?: string; corner?: string; logo?: string | null; [k: string]: unknown };

export const BrandSlot: React.FC<{ spec: BrandSlotSpec }> = ({ spec }) => {
  const slot = resolveBrandSlot(spec);
  const content = slotContent(slot);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const brand = useBrand();
  useSignatureFont(content.kind === "text");
  const { opacity, reveal } = brandSlotState(frame / fps, slot);
  const scale = slotScale(width, height);
  const ink = brand.colors.ink ?? "#000000";
  const common: React.CSSProperties = { position: "absolute", ...slotPlacement(slot.corner, slot.margin, width, height), opacity, pointerEvents: "none" };
  if (content.kind === "logo") {
    return <Img src={staticFile(content.src)} style={{ ...common, height: slot.logoHeight * scale, width: "auto", clipPath: `inset(-10% ${100 - reveal * 110}% -10% -10%)` }} />;
  }
  // Wipe left to right like a pen stroke. The insets are negative on the other three sides, and on the right once the reveal is done, so the script's long overhangs are never clipped.
  return (
    <div style={{ ...common, color: ink, fontFamily: `'${SIGNATURE_FAMILY}', ${FALLBACK}`, fontSize: slot.fontSize * scale, lineHeight: 1, whiteSpace: "nowrap", clipPath: `inset(-30% ${100 - reveal * 125}% -30% -30%)` }}>
      {content.text}
    </div>
  );
};
