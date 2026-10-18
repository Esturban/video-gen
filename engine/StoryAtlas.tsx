// REUSE_CHECKED: 1_social/py/video-gen/engine/geo.ts   countries, projections and camera maths come from there; this is the drawn atlas layer
// Story atlas (CMO-8248, promoted from the Riyadh Lab thank-you film): one continuous map layer for a "this idea travelled the world"
// story. An orthographic globe on a keyed camera with great-circle trails, pulsing pins and lit countries, a pin label, then a hand-off
// to a flat Equal Earth atlas with lifted arcs, city tags and a zoom onto one focus city. Everything is data (scene.json), keyed in
// seconds on the atlas clock; `timeMap` lets an atlas keyed on an earlier cut follow a re-timed film (kineticMath remapTime).
import React from "react";
import { geoInterpolate, geoPath, GeoPath, GeoProjection } from "d3-geo";
import { arcPath, bezierAt, camAt, COUNTRIES, COUNTRY_BY_A3, FlatZoom, flatZoomFor, GlobeKey, globeFor, GRATICULE, isVisibleFrom, LonLat } from "./geo";
import { lerp, ramp, remapTime, window01 } from "./kineticMath.js";
import { FilmPalette, tint, useFilmStyle, useSec } from "./kinetic";

type Ink = keyof FilmPalette;
export type AtlasConfig = {
  cities: Record<string, LonLat>;
  timeMap?: { now: [number, number][]; was: [number, number][] };
  globe: {
    keys: GlobeKey[];
    x: number;
    pins: { city: string; at: number; until: number }[];
    trails: { a: string; b: string; start: number; dur: number; end: number; width?: number; dotted?: boolean }[];
  };
  flat: FlatZoom & {
    focus: string;
    trails: { a: string; b: string; start: number; dur: number; bright?: boolean; lift?: number }[];
    dimTrails: [number, number];
    pins: { cities: string[]; at: number; step: number };
    focusPinAt: number;
    tags: { show: [number, number]; step: number; items: { city: string; name: string; sub: string; dx: number; dy: number; align: "left" | "right" }[] };
  };
  highlights: { a3: string; a: number; b: number; ink?: Ink }[];
  label?: { city: string; text: string; show: [number, number] };
  phases: { dim: [number, number]; dimBy: number; toFlat: [number, number]; flatDim: [number, number]; flatDimTo: number; flatOut: [number, number] };
  inks?: { land?: string; oceanLight?: string; oceanEdge?: string; brightTrail?: string };
};

const INKS = { land: "#17345c", oceanLight: "#123260", oceanEdge: "#060d1b", brightTrail: "#ffd27a" };

const Countries: React.FC<{ t: number; path: GeoPath; cfg: AtlasConfig }> = ({ t, path, cfg }) => {
  const { C } = useFilmStyle();
  const land = cfg.inks?.land ?? INKS.land;
  return (
    <g>
      <path d={path({ type: "FeatureCollection", features: COUNTRIES }) ?? ""} fill={land} stroke={C.teal} strokeOpacity={0.5} strokeWidth={1} strokeLinejoin="round" />
      {cfg.highlights.map((h, i) => {
        const w = window01(t, h.a, h.b, 0.7);
        if (w <= 0) return null;
        const feature = COUNTRY_BY_A3[h.a3];
        if (!feature) throw new Error(`StoryAtlas: highlight ${i} names country "${h.a3}", which is not an ADM0_A3 code in the map`);
        const d = path(feature) ?? "";
        const col = C[h.ink ?? "amber"];
        return (
          <g key={i} opacity={w}>
            <path d={d} fill={col} fillOpacity={0.3} stroke="none" />
            <path d={d} fill="none" stroke={col} strokeWidth={6} strokeOpacity={0.35} filter="url(#glow)" />
            <path d={d} fill="none" stroke={col} strokeWidth={2.4} strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
};

const Pulse: React.FC<{ x: number; y: number; t: number; at: number; color?: string; big?: boolean }> = ({ x, y, t, at, color, big }) => {
  const { C } = useFilmStyle();
  const ink = color ?? C.amber;
  const on = ramp(t, at, at + 0.4);
  if (on <= 0) return null;
  const cyc = ((t - at) % 1.6) / 1.6;
  const r0 = big ? 12 : 8;
  return (
    <g opacity={on}>
      <circle cx={x} cy={y} r={r0 + cyc * (big ? 60 : 36)} fill="none" stroke={ink} strokeWidth={2.5} opacity={1 - cyc} />
      <circle cx={x} cy={y} r={r0 * 2.4} fill={ink} opacity={0.25} filter="url(#glow)" />
      <circle cx={x} cy={y} r={r0} fill={ink} />
      <circle cx={x} cy={y} r={r0 * 0.45} fill="#fff" />
    </g>
  );
};

const Defs: React.FC<{ cfg: AtlasConfig }> = ({ cfg }) => {
  const { C } = useFilmStyle();
  return (
    <defs>
      <radialGradient id="ocean" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stopColor={cfg.inks?.oceanLight ?? INKS.oceanLight} />
        <stop offset="60%" stopColor={C.deep} />
        <stop offset="100%" stopColor={cfg.inks?.oceanEdge ?? INKS.oceanEdge} />
      </radialGradient>
      <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
        <stop offset="80%" stopColor={C.teal} stopOpacity={0.22} />
        <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="shade" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.1} />
        <stop offset="55%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
      </radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  );
};

const cityOf = (cfg: AtlasConfig, k: string): LonLat => {
  const ll = cfg.cities[k];
  if (!ll) throw new Error(`StoryAtlas: city "${k}" is not in cities (has: ${Object.keys(cfg.cities).join(", ")})`);
  return ll;
};

const GlobeTrails: React.FC<{ t: number; proj: GeoProjection; cfg: AtlasConfig }> = ({ t, proj, cfg }) => {
  const { C } = useFilmStyle();
  const path = geoPath(proj);
  const cam = camAt(cfg.globe.keys, t);
  return (
    <g>
      {cfg.globe.trails.map((tr, i) => {
        const p = ramp(t, tr.start, tr.start + tr.dur);
        const vis = window01(t, tr.start, tr.end, 0.6);
        if (p <= 0 || vis <= 0) return null;
        const interp = geoInterpolate(cityOf(cfg, tr.a), cityOf(cfg, tr.b));
        const coords = Array.from({ length: 49 }, (_, k) => interp((k / 48) * p));
        const d = path({ type: "LineString", coordinates: coords }) ?? "";
        const head = interp(p);
        const hp = isVisibleFrom(cam, head) ? proj(head) : null;
        const w = tr.width ?? 3;
        return (
          <g key={i} opacity={vis}>
            <path d={d} fill="none" stroke={C.amber} strokeWidth={w * 3} opacity={0.35} filter="url(#glow)" />
            <path d={d} fill="none" stroke={C.amber} strokeWidth={w} strokeLinecap="round" strokeDasharray={tr.dotted ? `${w * 0.1} ${w * 3}` : undefined} />
            {hp && p < 1 ? <circle cx={hp[0]} cy={hp[1]} r={w * 2.6} fill="#fff" filter="url(#glow)" /> : null}
            {hp && p < 1 ? <circle cx={hp[0]} cy={hp[1]} r={w * 1.2} fill="#fff" /> : null}
          </g>
        );
      })}
    </g>
  );
};

const Globe: React.FC<{ t: number; opacity: number; cfg: AtlasConfig }> = ({ t, opacity, cfg }) => {
  const { C } = useFilmStyle();
  const cam = camAt(cfg.globe.keys, t);
  const proj = globeFor(cam, cfg.globe.x);
  const path = geoPath(proj);
  const { r, cy } = cam;
  const cx = cfg.globe.x;
  const intro = ramp(t, 0, 2);
  return (
    <g opacity={opacity * intro}>
      <circle cx={cx} cy={cy} r={r * 1.09} fill="url(#atmo)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#ocean)" />
      <path d={path(GRATICULE) ?? ""} fill="none" stroke={C.teal} strokeOpacity={0.12} strokeWidth={1} />
      <Countries t={t} path={path} cfg={cfg} />
      <circle cx={cx} cy={cy} r={r} fill="url(#shade)" />
      <GlobeTrails t={t} proj={proj} cfg={cfg} />
      {cfg.globe.pins.map((pn, i) => {
        const ll = cityOf(cfg, pn.city);
        const xy = isVisibleFrom(cam, ll) ? proj(ll) : null;
        if (!xy || t > pn.until) return null;
        return <Pulse key={i} x={xy[0]} y={xy[1]} t={t} at={pn.at} />;
      })}
    </g>
  );
};

const FlatAtlas: React.FC<{ t: number; opacity: number; cfg: AtlasConfig }> = ({ t, opacity, cfg }) => {
  const { C } = useFilmStyle();
  const f = cfg.flat;
  const proj = flatZoomFor(t, cityOf(cfg, f.focus), f);
  const path = geoPath(proj);
  const xy = (k: string) => proj(cityOf(cfg, k)) as [number, number];
  const zoomP = ramp(t, f.zoom.from, f.zoom.to);
  return (
    <g opacity={opacity}>
      <path d={path({ type: "Sphere" }) ?? ""} fill={C.deep} opacity={0.55} />
      <path d={path(GRATICULE) ?? ""} fill="none" stroke={C.teal} strokeOpacity={0.1} strokeWidth={1} />
      <Countries t={t} path={path} cfg={cfg} />
      {f.trails.map((tr, i) => {
        const p = ramp(t, tr.start, tr.start + tr.dur);
        if (p <= 0) return null;
        const a = xy(tr.a);
        const b = xy(tr.b);
        const arc = arcPath(a, b, tr.lift ?? 0.28);
        const head = bezierAt(a, arc.c, b, p);
        const w = tr.bright ? 5 : 3;
        const fade = tr.bright ? 1 : 1 - 0.6 * ramp(t, f.dimTrails[0], f.dimTrails[1]);
        return (
          <g key={i} opacity={fade * (1 - zoomP * 0.7)}>
            <path d={arc.d} pathLength={1} strokeDasharray={`${p} 1`} fill="none" stroke={C.amber} strokeWidth={w * 3} opacity={0.35} filter="url(#glow)" />
            <path d={arc.d} pathLength={1} strokeDasharray={`${p} 1`} fill="none" stroke={tr.bright ? cfg.inks?.brightTrail ?? INKS.brightTrail : C.amber} strokeWidth={w} strokeLinecap="round" />
            {p < 1 ? <circle cx={head[0]} cy={head[1]} r={w * 2} fill="#fff" /> : null}
          </g>
        );
      })}
      {f.pins.cities.map((k, i) => {
        const [x, y] = xy(k);
        return <Pulse key={k} x={x} y={y} t={t} at={f.pins.at + i * f.pins.step} />;
      })}
      <Pulse x={xy(f.focus)[0]} y={xy(f.focus)[1]} t={t} at={f.focusPinAt} color={C.teal} big />
    </g>
  );
};

const PinLabel: React.FC<{ t: number; cfg: AtlasConfig }> = ({ t, cfg }) => {
  const { C, font } = useFilmStyle();
  if (!cfg.label) return null;
  const vis = window01(t, cfg.label.show[0], cfg.label.show[1], 0.5);
  if (vis <= 0) return null;
  const p = globeFor(camAt(cfg.globe.keys, t), cfg.globe.x)(cityOf(cfg, cfg.label.city));
  if (!p) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: p[0] - 300,
        width: 600,
        textAlign: "center",
        top: p[1] + 44,
        opacity: vis,
        fontFamily: font,
        fontSize: 64,
        fontWeight: 600,
        color: C.amber,
        whiteSpace: "nowrap",
        textShadow: `0 2px 18px ${tint(C.night, 0.95)}`,
      }}
    >
      {cfg.label.text}
    </div>
  );
};

const FlatTags: React.FC<{ t: number; cfg: AtlasConfig; width: number; height: number }> = ({ t, cfg, width, height }) => {
  const { C, font } = useFilmStyle();
  const tags = cfg.flat.tags;
  const vis = window01(t, tags.show[0], tags.show[1], 0.5);
  if (vis <= 0) return null;
  const proj = flatZoomFor(t, cityOf(cfg, cfg.flat.focus), cfg.flat);
  return (
    <>
      {tags.items.map((tag, i) => {
        const p = ramp(t, tags.show[0] + i * tags.step, tags.show[0] + 0.5 + i * tags.step);
        const [x, y] = proj(cityOf(cfg, tag.city)) as [number, number];
        const ax = x + tag.dx;
        const ay = y + tag.dy;
        return (
          <React.Fragment key={tag.city}>
            <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: vis * p }}>
              <line x1={x} y1={y} x2={ax} y2={ay + 40} stroke={C.amber} strokeWidth={2} strokeDasharray="4 6" />
            </svg>
            <div
              style={{
                position: "absolute",
                top: ay,
                ...(tag.align === "right" ? { right: width - ax } : { left: ax }),
                opacity: vis * p,
                transform: `translateY(${(1 - p) * 10}px)`,
                padding: "8px 18px",
                borderRadius: 14,
                background: tint(C.night, 0.88),
                border: `2px solid ${C.amber}`,
                fontFamily: font,
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ fontSize: 48, fontWeight: 700, color: C.white, lineHeight: 1.05 }}>{tag.name}</div>
              <div style={{ fontSize: 38, fontWeight: 600, color: C.amber, lineHeight: 1.1 }}>{tag.sub}</div>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

export const StoryAtlas: React.FC<{ config: AtlasConfig; width?: number; height?: number }> = ({ config: cfg, width = 1080, height = 1350 }) => {
  const sec = useSec();
  const t = cfg.timeMap ? remapTime(sec, cfg.timeMap.now, cfg.timeMap.was) : sec;
  const ph = cfg.phases;
  // The globe dims under an overlay, then hands off to the flat atlas, which dims and fades out in turn.
  const dim = window01(t, ph.dim[0], ph.dim[1], 0.8);
  const toFlat = ramp(t, ph.toFlat[0], ph.toFlat[1]);
  const globeOpacity = (1 - ph.dimBy * dim) * (1 - toFlat);
  const flatOpacity = toFlat * lerp(1, ph.flatDimTo, ramp(t, ph.flatDim[0], ph.flatDim[1])) * (1 - ramp(t, ph.flatOut[0], ph.flatOut[1]));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <Defs cfg={cfg} />
        {globeOpacity > 0.01 ? <Globe t={t} opacity={globeOpacity} cfg={cfg} /> : null}
        {flatOpacity > 0.01 ? <FlatAtlas t={t} opacity={flatOpacity} cfg={cfg} /> : null}
      </svg>
      <PinLabel t={t} cfg={cfg} />
      <FlatTags t={t} cfg={cfg} width={width} height={height} />
    </div>
  );
};
