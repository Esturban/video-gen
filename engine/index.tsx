// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/riyadh-day3/motion/video/src/Root.tsx   one fixed Composition per project there; here one Composition whose size, fps and length come from the scene file
import React from "react";
import { CalculateMetadataFunction, Composition, registerRoot } from "remotion";
import { Video, VideoProps } from "./Video";

// bin/video passes the real scene, brand and fps as input props; these defaults only keep the Studio from crashing.
const DEFAULTS: VideoProps = {
  fps: 30,
  brand: { name: "none", background: "#14406e", font: "sans-serif", colors: {} },
  scene: { name: "empty", brand: "none", beats: [{ n: 0, start: 0, end: 1, kind: "" }] },
};

const metadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const [width, height] = props.scene.size ?? [1920, 1080];
  const end = props.scene.beats[props.scene.beats.length - 1].end;
  return { fps: props.fps, width, height, durationInFrames: Math.round(end * props.fps) };
};

const Root: React.FC = () => (
  <Composition id="Video" component={Video} defaultProps={DEFAULTS} calculateMetadata={metadata} durationInFrames={30} fps={30} width={1920} height={1080} />
);

registerRoot(Root);
