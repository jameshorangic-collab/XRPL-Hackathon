import { useEffect } from "react";
// Decorative backdrop. The noisy liquid is rendered once as static SVG images;
// scrolling only moves those layers and shifts the tint. Nothing runs while idle.
const uri = (svg: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
type Pool = [number, number, number, string, number];
function liquid(seed: number, pools: Pool[], scale: number) {
  const shapes = pools
    .map(
      ([x, y, r, c, a], i) =>
        `<radialGradient id='g${i}'><stop offset='0' stop-color='${c}' stop-opacity='${a}'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient><circle cx='${x}' cy='${y}' r='${r}' fill='url(#g${i})'/>`,
    )
    .join("");
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'><filter id='w' x='-20%' y='-20%' width='140%' height='140%'><feTurbulence type='fractalNoise' baseFrequency='0.0045' numOctaves='4' seed='${seed}'/><feDisplacementMap in='SourceGraphic' scale='${scale}' xChannelSelector='R' yChannelSelector='G'/><feGaussianBlur stdDeviation='6'/></filter><g filter='url(#w)'>${shapes}</g></svg>`,
  );
}
const layers = {
  pools: liquid(
    5,
    [
      [260, 220, 330, "#c9a77c", 0.7],
      [1250, 180, 360, "#b9c6db", 0.75],
      [820, 620, 380, "#e6dccb", 0.9],
      [180, 820, 280, "#a46a3c", 0.4],
      [1420, 780, 300, "#c9a77c", 0.55],
      [640, 140, 200, "#ffffff", 0.9],
      [1050, 460, 220, "#b9c6db", 0.55],
      [420, 520, 180, "#f3e6cf", 0.9],
      [1500, 420, 160, "#a46a3c", 0.3],
      [920, 900, 240, "#b9c6db", 0.45],
    ],
    220,
  ),
  depth: liquid(
    9,
    [
      [380, 380, 260, "#a46a3c", 0.3],
      [1100, 300, 300, "#8e9fbd", 0.35],
      [700, 820, 320, "#c9a77c", 0.4],
      [1450, 900, 240, "#14264a", 0.15],
      [150, 100, 220, "#b9c6db", 0.4],
      [980, 640, 180, "#85522b", 0.2],
    ],
    260,
  ),
  veins: uri(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='0.003 0.005' numOctaves='4' seed='11'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='table' tableValues='0 0 1 0 0 1 0 0'/><feFuncG type='table' tableValues='0 0 1 0 0 1 0 0'/><feFuncB type='table' tableValues='0 0 1 0 0 1 0 0'/></feComponentTransfer><feGaussianBlur stdDeviation='1.4'/></filter><rect width='1600' height='1000' filter='url(#m)'/></svg>",
  ),
  grain: uri(
    "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#g)' opacity='0.5'/></svg>",
  ),
};
const tones = [
  ["#f3eee4", "#e6dccb"],
  ["#efe7da", "#dccfb9"],
  ["#e9ecf1", "#d3dbe7"],
  ["#f1e6d6", "#d8c2a3"],
];
const hex = (h: string) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  `rgb(${hex(a)
    .map((v, i) => Math.round(v + (hex(b)[i] - v) * t))
    .join(",")})`;
export default function LiquidBackground() {
  useEffect(() => {
    const root = document.documentElement.style;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const s = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      root.setProperty("--scroll", s.toFixed(4));
      const f = s * (tones.length - 1);
      const k = Math.min(tones.length - 2, Math.floor(f));
      const t = f - k;
      root.setProperty("--tint-1", mix(tones[k][0], tones[k + 1][0], t));
      root.setProperty("--tint-2", mix(tones[k][1], tones[k + 1][1], t));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="liquid" aria-hidden="true">
      <div
        className="liquid-layer pools"
        style={{ backgroundImage: layers.pools }}
      />
      <div
        className="liquid-layer depth"
        style={{ backgroundImage: layers.depth }}
      />
      <div
        className="liquid-layer veins"
        style={{ backgroundImage: layers.veins }}
      />
      <div className="liquid-grain" style={{ backgroundImage: layers.grain }} />
    </div>
  );
}
