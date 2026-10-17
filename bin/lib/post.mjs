// LinkedIn post step (CMO-8170): every render writes post.md beside the mp4. Pure functions; bin/video does the file write.
// Rules: under 80 words, a non-empty hook on line one, says "video", at most 2 hashtags, no em or en dash.
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`); // built from char codes so this file carries neither
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;

export const MAX_WORDS = 80; // the post must stay strictly under this
export const MAX_HASHTAGS = 2;
const DEFAULT_CTA = "The full story is in the video.";

export const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const oneLine = (s) => s.replace(/\s+/g, " ").trim();
const firstSentence = (s) => oneLine(s).split(/(?<=[.!?])\s/)[0];

/** Problems with finished post text. Empty array means it can ship. */
export function postProblems(text) {
  const problems = [];
  const words = wordCount(text);
  if (words >= MAX_WORDS) problems.push(`post is ${words} words: keep it under ${MAX_WORDS} words`);
  if (!text.split("\n")[0].trim()) problems.push("post first line is empty: line one must be the hook");
  if (!/video/i.test(text)) problems.push('post never says "video": the hook must point at the video');
  const tags = text.match(HASHTAG) ?? [];
  if (tags.length > MAX_HASHTAGS) problems.push(`post has ${tags.length} hashtags: at most ${MAX_HASHTAGS} hashtags`);
  if (DASH.test(text)) problems.push("post contains an em or en dash: use a comma, colon or full stop");
  return problems;
}

/**
 * Build the post for a scene. Fields come from scene.post {hook, body, cta}; a missing hook is derived from history
 * (first sentence) or aha, a missing body from aha. A scene with no aha and no post is skipped, not failed.
 * Returns { skip: true, reason } or { text, words, problems }.
 */
export function postFor(scene) {
  const post = scene.post && typeof scene.post === "object" ? scene.post : {};
  const aha = clean(scene.aha);
  if (scene.post === undefined && !aha) return { skip: true, reason: "no aha or post fields on this scene" };
  const history = clean(scene.history);
  const hook = clean(post.hook) || (history ? firstSentence(history) : aha ? firstSentence(aha) : "");
  const derivedBody = history ? aha : aha.slice(firstSentence(aha).length).trim();
  const body = clean(post.body) || derivedBody;
  const cta = clean(post.cta) || DEFAULT_CTA;
  if (!hook) return { text: "", words: 0, problems: ["post has no hook: set post.hook, or give the scene a history or aha to derive one from"] };
  const text = [hook, body, cta].filter(Boolean).join("\n\n");
  return { text, words: wordCount(text), problems: postProblems(text) };
}
