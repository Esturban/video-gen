// REUSE_CHECKED: 1_social/py/video-gen/engine/geoMath.js   the pure maths (camera keys, visibility, arcs) lives there; this file adds the d3-geo layer
// World map layer for any scene (CMO-8248, promoted from the Riyadh Lab thank-you film): Natural Earth country outlines,
// a graticule, and an orthographic globe projection driven by a keyed camera. d3-geo 3.1.1 (ISC).
// Country outlines: Natural Earth 1:50m admin-0 countries (public domain), fetched from
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
// and slimmed to { a3, name } with coordinates rounded to 0.001 degrees (engine/assets/geo/countries-50m.json).
import { geoArea, geoEqualEarth, geoGraticule10, geoOrthographic, GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import countries50 from "./assets/geo/countries-50m.json";
import { arcPath, bezierAt, camAt, easeInOutCubic, isVisibleFrom } from "./geoMath.js";

export { arcPath, bezierAt, camAt, easeInOutCubic, isVisibleFrom };

export type LonLat = [number, number];
export type GlobeKey = [t: number, lon: number, lat: number, radius: number, cy: number];
export type GlobeCam = { lon: number; lat: number; r: number; cy: number };
export type CountryFeature = Feature<Polygon | MultiPolygon, { a3: string; name: string }>;

// GeoJSON (RFC 7946) rings run counter-clockwise; d3-geo reads that as "everything but this shape".
// Rewind any polygon whose spherical area exceeds a hemisphere.
const rewindPolygon = (rings: Position[][]): Position[][] =>
  geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;

const rewind = (f: CountryFeature): CountryFeature => {
  const g = f.geometry;
  const geometry: Polygon | MultiPolygon =
    g.type === "Polygon" ? { type: "Polygon", coordinates: rewindPolygon(g.coordinates) } : { type: "MultiPolygon", coordinates: g.coordinates.map(rewindPolygon) };
  return { ...f, geometry };
};

// France's feature also holds French Guiana and other overseas parts; keep only metropolitan France for a highlight.
const mainlandOnly = (f: CountryFeature): CountryFeature => {
  if (f.properties.a3 !== "FRA" || f.geometry.type !== "MultiPolygon") return f;
  const coords = f.geometry.coordinates.filter((poly) => poly[0].every(([lon, lat]) => lon > -10 && lon < 12 && lat > 40));
  return { ...f, geometry: { type: "MultiPolygon", coordinates: coords } };
};

const RAW = countries50 as unknown as FeatureCollection<Polygon | MultiPolygon, { a3: string; name: string }>;
/** Every country, wound for d3-geo. Draw these for the base map. */
export const COUNTRIES: CountryFeature[] = RAW.features.map(rewind);
/** One country by its ADM0_A3 code, for a highlight (France is metropolitan only). */
export const COUNTRY_BY_A3: Record<string, CountryFeature> = Object.fromEntries(COUNTRIES.map((f) => [f.properties.a3, mainlandOnly(f)]));
export const GRATICULE = geoGraticule10();

/** Orthographic globe for a camera, centred horizontally on x. */
export const globeFor = (c: GlobeCam, x: number): GeoProjection =>
  geoOrthographic()
    .rotate([-c.lon, -c.lat])
    .scale(c.r)
    .translate([x, c.cy])
    .clipAngle(90)
    .precision(0.4);

/** Flat Equal Earth map that, between zoom.from and zoom.to, zooms in log scale while `focus` glides to `target` on screen. */
export type FlatZoom = { rotate: number; baseScale: number; center: [number, number]; target: [number, number]; zoom: { from: number; to: number; scale: number } };

export const flatZoomFor = (t: number, focus: LonLat, f: FlatZoom): GeoProjection => {
  const base = geoEqualEarth().rotate([f.rotate, 0]).scale(f.baseScale).translate(f.center).precision(0.4);
  const p = easeInOutCubic(Math.min(1, Math.max(0, (t - f.zoom.from) / (f.zoom.to - f.zoom.from))));
  if (p === 0) return base;
  const start = base(focus) as [number, number];
  const scale = Math.exp(Math.log(f.baseScale) + (Math.log(f.zoom.scale) - Math.log(f.baseScale)) * p);
  const zoomed = geoEqualEarth().rotate([f.rotate, 0]).scale(scale).translate([0, 0]).precision(0.4);
  const rz = zoomed(focus) as [number, number];
  const target: [number, number] = [start[0] + (f.target[0] - start[0]) * p, start[1] + (f.target[1] - start[1]) * p];
  return zoomed.translate([target[0] - rz[0], target[1] - rz[1]]);
};
