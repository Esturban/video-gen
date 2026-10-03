// REUSE_CHECKED: 1_social/py/video-gen/engine/motion.ts (our own typed door pattern, round 3); this file only re-exports the new pure morph files.
// The morph vocabulary scenes import as "@video/engine/morph": equal-length point-list shapes, colour mixing and the camera path.
// The maths lives in morphMath.js, colorMath.js, cameraMath.js and chartStoryMath.js so node:test can run it; webpack resolves "morph.js" before "morph.ts", and none of those files shares this base name.
export { POLY_LENGTH, SIDES, bendPoint, bentRectPoly, circlePoly, maxPointDistance, morphPoly, pointPoly, polyArea, polyPath, quadPoly, roundedRectPoly, roundedRectPoint, segmentQuad } from "./morphMath.js";
export { mixRgb, parseColor, rgbCss } from "./colorMath.js";
export { cameraAt, viewBoxFor } from "./cameraMath.js";
export { BENTO_WINDOW, EXTRA_WINDOWS, STAGE_WINDOWS, buildStory, stageTimes } from "./chartStoryMath.js";
export { areaGeometry, cumulative, shareSegments, stackedSegments, tileReveal } from "./bentoMath.js";
export { driftOffset, layerShift, motes } from "./parallaxMath.js";
export { crispTime } from "./crispTime.js";
