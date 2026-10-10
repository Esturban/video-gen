// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/riyadh-day3/motion/video/src/Explainer.tsx   its Fader, Progress and beat loop are this file, generalised to any scene file; mashreq Demo.tsx had the same three copied
import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Beat, BeatContext, Brand, BrandContext, Scene, SceneContext } from "./beat";
import { BrandSlot } from "./brandSlot";
import { Captions } from "./captions";
import { KINDS } from "@video/kinds"; // alias set per scene by bin/lib/webpack-override.mjs

export type VideoProps = { scene: Scene; brand: Brand; fps: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Fader: React.FC<{ frames: number; fade: number; first: boolean; last: boolean; children: React.ReactNode }> = ({ frames, fade, first, last, children }) => {
  const f = useCurrentFrame();
  const out = last || fade === 0 ? 1 : interpolate(f, [frames - fade, frames], [1, 0], clamp);
  const inn = first || fade === 0 ? 1 : interpolate(f, [0, fade], [0, 1], clamp);
  return <AbsoluteFill style={{ opacity: Math.min(inn, out) }}>{children}</AbsoluteFill>;
};

const Progress: React.FC<{ beats: Beat[] }> = ({ beats }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = f / fps;
  return (
    <div style={{ position: "absolute", left: 90, right: 90, bottom: 34, display: "flex", gap: 8 }}>
      {beats.map((b) => {
        const fill = Math.max(0, Math.min(1, (s - b.start) / (b.end - b.start)));
        return (
          <div key={b.n} style={{ flex: b.end - b.start, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
            <div style={{ width: `${fill * 100}%`, height: "100%", background: "rgba(255,255,255,0.8)" }} />
          </div>
        );
      })}
    </div>
  );
};

export const Video: React.FC<VideoProps> = ({ scene, brand }) => {
  const { fps } = useVideoConfig();
  const fade = Math.round((scene.fade ?? 0.5) * fps);
  const beats = scene.beats;
  return (
    <SceneContext.Provider value={scene}>
      <BrandContext.Provider value={brand}>
        <AbsoluteFill style={{ background: brand.background, fontFamily: brand.font }}>
          {beats.map((b, i) => {
            const Kind = KINDS[b.kind];
            if (!Kind) throw new Error(`beat ${b.n}: kind "${b.kind}" is not in this video's kinds.tsx (has: ${Object.keys(KINDS).join(", ")})`);
            const from = Math.round(b.start * fps);
            const frames = Math.round(b.end * fps) - from;
            return (
              <Sequence key={b.n} from={from} durationInFrames={frames}>
                <BeatContext.Provider value={b}>
                  <Fader frames={frames} fade={fade} first={i === 0} last={i === beats.length - 1}>
                    <Kind />
                  </Fader>
                </BeatContext.Provider>
              </Sequence>
            );
          })}
          {scene.progress ? <Progress beats={beats} /> : null}
          {scene.brandSlot ? <BrandSlot spec={scene.brandSlot} /> : null}
          {scene.captions && scene.words ? <Captions words={scene.words} options={typeof scene.captions === "object" ? scene.captions : undefined} /> : null}
        </AbsoluteFill>
      </BrandContext.Provider>
    </SceneContext.Provider>
  );
};
