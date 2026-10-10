// The shape of the beat in scene.json. Every string and timing on screen comes from here.
export type Timeline = {
  pointerIn: number; fieldArrive: number; typeStart: number; leaveField: number; buttonArrive: number;
  rowsStart: number; rowsStep: number; rowsDur: number; pointerAway: number;
};
export type UiCfg = {
  windowTitle: string; fieldLabel: string; placeholder: string; task: string; button: string; resultsLabel: string;
  results: string[];
  typing: { cps: number; pauses?: { at: number; dur: number }[] };
  tl: Timeline;
};
