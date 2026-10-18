// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/stagesA.tsx   CrowdStage/ReportStage/RouteStage, and stagesB.tsx TwinStage/ChatStage, moved here unchanged in look; copy now comes in as props, colours from the brand. FlowNetwork (money-flow graph with camera steps) and GrowLine (log-scale series) are different parts, so not reused.
// Five schematic stages for a ToolStageFrame (all draw into the 1140x860 StageSvg):
//   HourBarsStage    : a card with an hourly bar chart; bars grow in turn, the peak bar turns warm and gets a label.
//   PhoneReportStage : a street with three lights (one dark) and a phone form that fills in and sends.
//   RouteFlowStage   : a report card flows to a "which team?" hub, then to one of several teams, then a reply.
//   NodeGraphStage   : labelled nodes link up; a route through them lights up.
//   ChatStage        : a chat window, questions and answers with typing dots in between.
import React from "react";
import { useSeconds, useT } from "./beat";
import { alpha, bubbleWidth, typingDot, within } from "./cityStageMath.js";
import { StageSvg, StageTag, useStagePalette } from "./ToolStageFrame";

type BarsProps = { title: string; tag: string; values: number[]; ticks: string[]; peak: number; peakLabel: string; label: string };

export const HourBarsStage: React.FC<BarsProps> = ({ title, tag, values, ticks, peak, peakLabel, label }) => {
  const t = useT();
  const { P } = useStagePalette();
  const card = t(0.3, 1.2);
  const lit = t(5.0, 6.0);
  return (
    <StageSvg label={label}>
      <g opacity={card} transform={`translate(70,${110 + (1 - card) * 30})`}>
        <rect width="1000" height="640" rx="28" fill={P.paper} />
        <text x="48" y="74" fontSize="34" fill={P.ink}>{title}</text>
        <StageTag text={tag} x={762} y={42} />
        <line x1="60" y1="540" x2="950" y2="540" stroke={P.mist} strokeWidth="3" />
        {values.map((h, i) => {
          const grow = t(1.2 + i * 0.22, 2.2 + i * 0.22);
          const H = 380 * h * grow;
          return (
            <g key={i}>
              <rect x={78 + i * 72} y={540 - H} width="50" height={H} rx="6" fill={i === peak && lit > 0 ? P.warn : P.sage} />
              <text x={103 + i * 72} y="580" textAnchor="middle" fontSize="20" fill={P.ink}>{ticks[i] ?? ""}</text>
            </g>
          );
        })}
        <g opacity={lit}>
          <rect x="560" y="102" width="220" height="50" rx="25" fill={P.ink} />
          <text x="670" y="135" textAnchor="middle" fontSize="23" fill={P.light}>{peakLabel}</text>
          <path d="M700 152 L 721 150" stroke={P.ink} strokeWidth="3" />
        </g>
      </g>
    </StageSvg>
  );
};

type ReportProps = { street: string; heading: string; fields: [string, string]; photo: string; send: string; sent: string; label: string };

export const PhoneReportStage: React.FC<ReportProps> = ({ street, heading, fields, photo, send, sent: sentLabel, label }) => {
  const t = useT();
  const s = useSeconds();
  const { P } = useStagePalette();
  const phone = t(0.3, 1.2);
  const f1 = t(1.6, 2.2);
  const f2 = t(2.6, 3.2);
  const f3 = t(3.6, 4.2);
  const sent = s > 5.4;
  const tick = t(5.4, 6.2);
  return (
    <StageSvg label={label}>
      <g opacity={t(0.2, 1.0)}>
        <rect x="560" y="560" width="560" height="90" rx="12" fill={alpha(P.light, 0.14)} />
        <path d="M580 605 L1100 605" stroke={alpha(P.light, 0.5)} strokeWidth="4" strokeDasharray="30 22" />
        {[640, 820, 1000].map((x, i) => (
          <g key={x}>
            <rect x={x - 5} y="330" width="10" height="230" fill={P.mist} />
            <path d={`M${x} 330 Q ${x + 10} 300 ${x + 60} 305`} stroke={P.mist} strokeWidth="10" fill="none" />
            <circle cx={x + 62} cy="318" r="18" fill={i === 1 ? P.sage : P.paper} />
            {i === 1 ? <circle cx={x + 62} cy="318" r={34} fill="none" stroke={P.warn} strokeWidth="4" opacity={t(1.0, 1.8)} /> : null}
          </g>
        ))}
        <text x="840" y="720" textAnchor="middle" fontSize="26" fontWeight="300" fill={P.light}>{street}</text>
      </g>
      <g opacity={phone} transform={`translate(90,${60 + (1 - phone) * 40})`}>
        <rect width="400" height="740" rx="54" fill={P.deep} stroke={P.mist} strokeWidth="4" />
        <rect x="20" y="30" width="360" height="680" rx="36" fill={P.paper} />
        <text x="50" y="104" fontSize="32" fontWeight="500" fill={P.ink}>{heading}</text>
        <g opacity={f1}><rect x="50" y="140" width="300" height="70" rx="12" fill={P.mist} /><text x="72" y="184" fontSize="25" fill={P.ink}>{fields[0]}</text></g>
        <g opacity={f2}><rect x="50" y="232" width="300" height="70" rx="12" fill={P.mist} /><text x="72" y="276" fontSize="25" fill={P.ink}>{fields[1]}</text></g>
        <g opacity={f3}>
          <rect x="50" y="324" width="300" height="190" rx="12" fill={P.mist} />
          <rect x="164" y="376" width="72" height="56" rx="10" fill="none" stroke={P.sage} strokeWidth="4" />
          <circle cx="200" cy="404" r="14" fill="none" stroke={P.sage} strokeWidth="4" />
          <text x="200" y="478" textAnchor="middle" fontSize="22" fill={P.ink}>{photo}</text>
        </g>
        <rect x="50" y="560" width="300" height="72" rx="36" fill={sent ? P.sage : P.ink} />
        <text x="200" y="606" textAnchor="middle" fontSize="28" fill={P.light}>{sent ? sentLabel : send}</text>
        {sent ? <path d="M268 596 l12 12 l22 -24" stroke={P.light} strokeWidth="5" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - tick} /> : null}
      </g>
    </StageSvg>
  );
};

type RouteProps = {
  card: { eyebrow: string; title: string; meta: string };
  hub: [string, string];
  teams: string[];
  hit?: number;
  reply: { eyebrow: string; text: string };
  label: string;
};

export const RouteFlowStage: React.FC<RouteProps> = ({ card, hub, teams, hit = 0, reply, label }) => {
  const t = useT();
  const { P } = useStagePalette();
  const inCard = t(0.3, 1.1);
  const toHub = t(1.4, 2.6);
  const toTeam = t(3.2, 4.4);
  const notify = t(4.6, 5.4);
  const back = t(6.4, 7.4);
  return (
    <StageSvg label={label}>
      <g opacity={inCard}>
        <rect x="20" y="300" width="300" height="170" rx="22" fill={P.paper} />
        <text x="46" y="352" fontSize="20" fill={P.ink} opacity="0.7">{card.eyebrow}</text>
        <text x="46" y="392" fontSize="24" fontWeight="500" fill={P.ink}>{card.title}</text>
        <text x="46" y="430" fontSize="22" fill={P.ink}>{card.meta}</text>
      </g>
      <path d="M320 385 L470 385" stroke={P.warn} strokeWidth="5" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - toHub} />
      <g opacity={t(2.2, 3.0)}>
        <circle cx="560" cy="385" r="88" fill={alpha(P.light, 0.14)} stroke={P.light} strokeWidth="3" />
        <text x="560" y="378" textAnchor="middle" fontSize="25" fill={P.light}>{hub[0]}</text>
        <text x="560" y="410" textAnchor="middle" fontSize="25" fill={P.light}>{hub[1]}</text>
      </g>
      {teams.map((name, i) => {
        const y = 170 + i * 215;
        const on = i === hit;
        return (
          <g key={name} opacity={t(2.6 + i * 0.2, 3.2 + i * 0.2)}>
            <path d={`M648 385 C 720 385, 740 ${y + 45}, 800 ${y + 45}`} stroke={on ? P.warn : alpha(P.light, 0.3)} strokeWidth={on ? 5 : 3} fill="none"
              pathLength={1} strokeDasharray={on ? "1 1" : "0.02 0.02"} strokeDashoffset={on ? 1 - toTeam : 0} />
            <rect x="800" y={y} width="300" height="90" rx="20" fill={on && notify > 0 ? P.paper : alpha(P.paper, 0.22)} />
            <text x="834" y={y + 55} fontSize="28" fill={on && notify > 0 ? P.ink : P.light} fontWeight={on ? 500 : 300}>{name}</text>
            {on ? (
              <g opacity={notify}><circle cx="1090" cy={y + 6} r="20" fill={P.warn} /><text x="1090" y={y + 14} textAnchor="middle" fontSize="22" fontWeight="600" fill={P.ink}>1</text></g>
            ) : null}
          </g>
        );
      })}
      <g opacity={back} transform={`translate(20,${560 + (1 - back) * 20})`}>
        <rect width="560" height="100" rx="22" fill={P.accent} />
        <text x="32" y="44" fontSize="21" fill={P.ink} opacity="0.75">{reply.eyebrow}</text>
        <text x="32" y="78" fontSize="26" fontWeight="500" fill={P.ink}>{reply.text}</text>
      </g>
    </StageSvg>
  );
};

type GraphProps = { nodes: Record<string, [number, number]>; edges: [string, string][]; route: string[]; routeLabel: string; label: string };

/** route lists edges as "from|to", matching the order in edges. */
export const NodeGraphStage: React.FC<GraphProps> = ({ nodes, edges, route, routeLabel, label }) => {
  const t = useT();
  const { P } = useStagePalette();
  const lit = t(6.0, 7.2);
  const onRoute = new Set(route);
  return (
    <StageSvg label={label}>
      {edges.map(([a, b], i) => {
        const [x1, y1] = nodes[a];
        const [x2, y2] = nodes[b];
        const on = onRoute.has(`${a}|${b}`) && lit > 0;
        return (
          <line key={`${a}${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? P.warn : P.accent} strokeWidth={on ? 7 : 4}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - t(1.8 + i * 0.35, 2.6 + i * 0.35)} opacity={on ? 1 : 0.8} />
        );
      })}
      {Object.entries(nodes).map(([name, [x, y]], i) => (
        <g key={name} opacity={t(0.4 + i * 0.2, 1.2 + i * 0.2)}>
          <rect x={x - 100} y={y - 38} width="200" height="76" rx="20" fill={P.mist} />
          <text x={x} y={y + 10} textAnchor="middle" fontSize="27" fill={P.ink}>{name}</text>
        </g>
      ))}
      <g opacity={lit}>
        <rect x="770" y="700" width="330" height="60" rx="30" fill={P.warn} />
        <text x="935" y="739" textAnchor="middle" fontSize="25" fontWeight="500" fill={P.ink}>{routeLabel}</text>
      </g>
    </StageSvg>
  );
};

/** One chat line: shown from `at` (fades in over 0.6s); `typing` is when the typing dots start before it (answers only). */
export type ChatLine = { y: number; text: string; me?: boolean; at: number; typing?: number };

const Bubble: React.FC<{ y: number; text: string; me?: boolean; o: number }> = ({ y, text, me, o }) => {
  const { P } = useStagePalette();
  const w = bubbleWidth(text);
  const x = me ? 1010 - w : 130;
  return (
    <g opacity={o} transform={`translate(0,${(1 - o) * 16})`}>
      <rect x={x} y={y} width={w} height="72" rx="36" fill={me ? P.paper : P.accent} />
      <text x={x + 30} y={y + 46} fontSize="27" fill={P.ink} fontWeight={me ? 400 : 500}>{text}</text>
    </g>
  );
};

export const ChatStage: React.FC<{ title: string; lines: ChatLine[]; label: string }> = ({ title, lines, label }) => {
  const t = useT();
  const s = useSeconds();
  const { P } = useStagePalette();
  return (
    <StageSvg label={label}>
      <g opacity={t(0.2, 1.0)}>
        <rect x="80" y="40" width="980" height="780" rx="36" fill={alpha(P.light, 0.1)} stroke={P.line} />
        <text x="130" y="112" fontSize="30" fontWeight="300" fill={P.light}>{title}</text>
      </g>
      {lines.map((m) => (
        <React.Fragment key={`${m.y}-${m.text}`}>
          {m.typing !== undefined && within(s, m.typing, m.at) ? (
            <g>
              <rect x="130" y={m.y} width="120" height="60" rx="30" fill={P.accent} />
              {[0, 1, 2].map((k) => <circle key={k} cx={165 + k * 26} cy={m.y + 30} r="8" fill={P.ink} opacity={typingDot(s, k)} />)}
            </g>
          ) : null}
          <Bubble y={m.y} text={m.text} me={m.me} o={t(m.at, m.at + 0.6)} />
        </React.Fragment>
      ))}
    </StageSvg>
  );
};
