import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Paper } from '../components/Paper';
import { colors } from '../theme';
import { display, mono } from '../fonts';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.8 } });
  const logoScale = interpolate(pop, [0, 1], [0.3, 1]);
  const logoRot = interpolate(pop, [0, 1], [-14, -4]);

  const raySpin = interpolate(frame, [0, 90], [0, 40]);
  const rayScale = interpolate(pop, [0, 1], [0.6, 1]);

  const tagline = spring({ frame: frame - 22, fps, config: { damping: 14 } });
  const stamp = spring({ frame: frame - 16, fps, config: { damping: 12 } });

  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* rotating tournament-color rays behind the logo */}
        <svg
          width={1500}
          height={1500}
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            opacity: 0.5,
            transform: `rotate(${raySpin}deg) scale(${rayScale})`,
          }}
        >
          {Array.from({ length: 28 }).map((_, i) => {
            const a = (i / 28) * Math.PI * 2;
            const palette = [colors.green, colors.gold, colors.red, colors.blue];
            return (
              <line
                key={i}
                x1={50}
                y1={50}
                x2={50 + Math.cos(a) * 60}
                y2={50 + Math.sin(a) * 60}
                stroke={palette[i % 4]}
                strokeWidth={3}
              />
            );
          })}
        </svg>

        <Img
          src={staticFile('glory-draw-logo.png')}
          style={{
            width: 520,
            transform: `scale(${logoScale}) rotate(${logoRot}deg)`,
            filter: 'drop-shadow(0 30px 40px rgba(33,27,22,0.35))',
            marginTop: -70,
          }}
        />

        <div
          style={{
            marginTop: 30,
            fontFamily: mono,
            fontWeight: 700,
            letterSpacing: 8,
            fontSize: 30,
            color: colors.ink,
            opacity: stamp,
            transform: `translateY(${interpolate(stamp, [0, 1], [20, 0])}px)`,
          }}
        >
          1950 · 2026
        </div>

        <div
          style={{
            marginTop: 14,
            fontFamily: display,
            fontWeight: 900,
            textTransform: 'uppercase',
            fontSize: 78,
            lineHeight: 0.9,
            textAlign: 'center',
            color: colors.ink,
            opacity: tagline,
            transform: `translateY(${interpolate(tagline, [0, 1], [30, 0])}px)`,
          }}
        >
          Build your <span style={{ color: colors.red }}>dream XI</span>
        </div>
      </AbsoluteFill>
    </Paper>
  );
};
