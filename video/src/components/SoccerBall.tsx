import React from 'react';
import { colors } from '../theme';

// Classic Telstar-style soccer ball: a central black pentagon, five black
// pentagons around the rim, joined by seams — drawn cleanly via computed
// polygon points so it reads as a real ball at any size.
const pentagon = (cx: number, cy: number, r: number, rotDeg: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((rotDeg - 90 + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
};

export const SoccerBall: React.FC<{ size?: number; spin?: number }> = ({
  size = 200,
  spin = 0,
}) => {
  const C = 50;
  const centralR = 15;
  // rim pentagons sit between the central pentagon's vertices
  const rim = Array.from({ length: 5 }).map((_, i) => {
    const a = ((-90 + 36 + i * 72) * Math.PI) / 180;
    const dist = 33;
    return {
      cx: C + dist * Math.cos(a),
      cy: C + dist * Math.sin(a),
      rot: -90 + 36 + i * 72 + 180,
    };
  });
  // seams from central vertices outward
  const seams = Array.from({ length: 5 }).map((_, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return {
      x1: C + centralR * Math.cos(a),
      y1: C + centralR * Math.sin(a),
      x2: C + 46 * Math.cos(a),
      y2: C + 46 * Math.sin(a),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${spin}deg)`, display: 'block' }}
    >
      <defs>
        <radialGradient id="ballShade" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="72%" stopColor="#f3efe4" />
          <stop offset="100%" stopColor="#d6cdba" />
        </radialGradient>
        <clipPath id="ballClip">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="47" fill="url(#ballShade)" stroke={colors.ink} strokeWidth="3" />

      <g clipPath="url(#ballClip)">
        {/* seams */}
        <g stroke={colors.ink} strokeWidth="2.4" opacity="0.55">
          {seams.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          ))}
        </g>
        {/* rim pentagons */}
        {rim.map((p, i) => (
          <polygon key={i} points={pentagon(p.cx, p.cy, 12, p.rot)} fill={colors.ink} />
        ))}
        {/* central pentagon */}
        <polygon points={pentagon(C, C, centralR, 0)} fill={colors.ink} />
      </g>
    </svg>
  );
};
