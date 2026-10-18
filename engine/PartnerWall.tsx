// REUSE_CHECKED: 1_social/py/video-gen/engine/brandSlot.tsx   that is one corner signature; this is a full partner wall of official logo files plus an end card
// Thank-you partner wall (CMO-8248, promoted from the Riyadh Lab thank-you film): official logo files shown unaltered on one shared
// dark backdrop, revealed one at a time in a set order, a slow light sweep, a heading line; and the end card that holds under it.
// House rules it encodes: logos are scaled only (never recoloured or cropped), no white boxes, a name is set beside a mark only when
// the mark does not already carry it, and a plain name tile stands in where no logo may be shown.
import React from "react";
import { Img, staticFile } from "remotion";
import { ramp } from "./kineticMath.js";
import { Line, tint, useFilmStyle, useSec } from "./kinetic";

/**
 * file: path inside the scene's assets/. text: a plain name tile instead of a file. plate "light" puts a dark-ink mark on a white plate.
 * h: visible mark height. pad: fraction of the file's height that is transparent padding (top and bottom). label: name set beside a mark
 * that does not spell it. wallScale: size multiplier on the wall only.
 */
export type Logo = { file?: string; text?: string; plate: "light" | "none"; h: number; pad?: number; label?: string; wallScale?: number };
export type WallRow = { logos: string[]; h: number };

/** An official logo file shown unaltered: scaled only, never recoloured, cropped or edited. */
export const LogoImg: React.FC<{ logo: Logo; h?: number }> = ({ logo, h = logo.h }) => {
  const { C, font } = useFilmStyle();
  if (logo.text) {
    return <span style={{ fontFamily: font, fontSize: h * 0.72, fontWeight: 700, color: C.white, letterSpacing: -0.5, lineHeight: 1, whiteSpace: "nowrap" }}>{logo.text}</span>;
  }
  const pad = logo.pad ?? 0;
  const fileH = h / (1 - 2 * pad);
  const img = <Img src={staticFile(logo.file ?? "")} style={{ height: fileH, width: "auto", display: "block", margin: `${-pad * fileH}px ${-pad * fileH * 0.5}px` }} />;
  const mark = logo.plate === "none" ? img : <div style={{ background: "#FFFFFF", borderRadius: 16, padding: `${Math.round(h * 0.16)}px ${Math.round(h * 0.24)}px`, display: "inline-flex", flex: "none" }}>{img}</div>;
  if (!logo.label) return mark;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: h * 0.22, flex: "none" }}>
      {mark}
      <span style={{ fontFamily: font, fontSize: h * 0.54, fontWeight: 600, color: C.white, letterSpacing: -0.5 }}>{logo.label}</span>
    </div>
  );
};

/** The one dark backdrop every partner logo sits on: same fill, border and radius everywhere. */
export const PartnerPanel: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => {
  const { C } = useFilmStyle();
  return (
    <div style={{ borderRadius: 28, background: tint(C.night, 0.95), border: `2px solid ${C.faint}`, display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
      {children}
    </div>
  );
};

const FIRST_AT = 0.8;
const STEP = 0.7;
const WALL_TOP = 310;

/** Heading, light sweep and the wall building one logo at a time in `order`. Give it the credits and end card lengths so it never cuts. */
export const PartnerWall: React.FC<{ heading: string; logos: Record<string, Logo>; rows: WallRow[]; order: string[] }> = ({ heading, logos, rows, order }) => {
  const t = useSec();
  const { C, side, top } = useFilmStyle();
  const sweep = ((t * 0.18) % 1.4) - 0.2;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(115deg, transparent ${sweep * 100 - 18}%, ${tint(C.amber, 0.1)} ${sweep * 100}%, transparent ${sweep * 100 + 18}%)`,
        }}
      />
      <div style={{ position: "absolute", left: side, right: side, top }}>
        <Line t={t} at={0.2} size={96} weight={700} color={C.amber} blurIn>
          {heading}
        </Line>
      </div>
      <PartnerPanel style={{ position: "absolute", left: side, right: side, top: WALL_TOP, padding: "26px 0", gap: 20 }}>
        {rows.map((row, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 56 }}>
            {row.logos.map((id) => {
              const logo = logos[id];
              if (!logo) throw new Error(`PartnerWall: row ${r} names logo "${id}", which is not in logos (has: ${Object.keys(logos).join(", ")})`);
              const at = FIRST_AT + order.indexOf(id) * STEP;
              const p = ramp(t, at, at + 0.45);
              const pop = t > at ? 1 + 0.06 * Math.sin(Math.min(1, (t - at) / 0.45) * Math.PI) : 1;
              return (
                <div key={logo.file ?? logo.text} style={{ opacity: p, transform: `translateY(${(1 - p) * 22}px) scale(${pop})` }}>
                  <LogoImg logo={logo} h={row.h * (logo.wallScale ?? 1)} />
                </div>
              );
            })}
          </div>
        ))}
      </PartnerPanel>
    </div>
  );
};

/** End card overlay: a drawn rule, the name in small tracked type, then the tagline. */
export const EndCard: React.FC<{ name: string; tagline: string; width?: number; height?: number }> = ({ name, tagline, width = 1080, height = 1350 }) => {
  const t = useSec();
  const { C, side } = useFilmStyle();
  const trail = ramp(t, 0.6, 2);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d="M290 1004 Q540 990 790 1004" fill="none" stroke={C.amber} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={`${trail} 1`} />
      </svg>
      <div style={{ position: "absolute", left: side, right: side, top: 1022, textAlign: "center" }}>
        <Line t={t} at={0.8} size={40} weight={600} color={C.teal} style={{ transformOrigin: "center", letterSpacing: 4, textTransform: "uppercase" }}>
          {name}
        </Line>
      </div>
      <div style={{ position: "absolute", left: side, right: side, top: 1078, textAlign: "center" }}>
        <Line t={t} at={1.8} size={56} weight={700} color={C.white} style={{ transformOrigin: "center" }}>
          {tagline}
        </Line>
      </div>
    </div>
  );
};
