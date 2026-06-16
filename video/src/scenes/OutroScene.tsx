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
import { SoccerBall } from '../components/SoccerBall';
import { colors } from '../theme';
import { display, mono, sans } from '../fonts';

// Decaying bounce arcs (peak height per arc, in px).
const ARCS = [
  { start: 0, dur: 18, h: 340 },
  { start: 18, dur: 15, h: 200 },
  { start: 33, dur: 12, h: 110 },
  { start: 45, dur: 9, h: 56 },
  { start: 54, dur: 7, h: 26 },
];

const bounceHeight = (f: number) => {
  for (const a of ARCS) {
    if (f >= a.start && f < a.start + a.dur) {
      const t = (f - a.start) / a.dur;
      return a.h * 4 * t * (1 - t);
    }
  }
  return 0;
};

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const baseline = 250;
  const ballY = baseline - bounceHeight(frame);
  const ballX = interpolate(frame, [0, 60], [-30, 30], { extrapolateRight: 'clamp' });
  const ballSpin = frame * 9;
  const squash = bounceHeight(frame) < 6 && frame > 4 ? 0.86 : 1;

  const title = spring({ frame: frame - 44, fps, config: { damping: 14 } });
  const cta = spring({ frame: frame - 56, fps, config: { damping: 16 } });
  const brand = spring({ frame: frame - 62, fps, config: { damping: 16 } });

  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* bouncing ball */}
        <div
          style={{
            position: 'absolute',
            top: ballY,
            transform: `translateX(${ballX}px) scaleY(${squash})`,
          }}
        >
          <SoccerBall size={150} spin={ballSpin} />
        </div>

        {/* headline */}
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              letterSpacing: 12,
              fontSize: 36,
              color: colors.inkSoft,
              opacity: title,
            }}
          >
            SIMULATE YOUR
          </div>
          <div
            style={{
              fontFamily: display,
              fontWeight: 900,
              textTransform: 'uppercase',
              fontSize: 210,
              lineHeight: 0.82,
              color: colors.ink,
              opacity: title,
              transform: `scale(${interpolate(title, [0, 1], [0.7, 1])})`,
            }}
          >
            World <span style={{ color: colors.red }}>Cup</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: sans,
              fontSize: 34,
              color: colors.ink,
              opacity: cta,
            }}
          >
            70 years of squads · pick any legend · one shot at glory
          </div>
        </div>

        {/* brand + domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 96,
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            opacity: brand,
            transform: `translateY(${interpolate(brand, [0, 1], [24, 0])}px)`,
          }}
        >
          <Img
            src={staticFile('glory-draw-logo.png')}
            style={{ width: 132, filter: 'drop-shadow(0 12px 16px rgba(33,27,22,0.28))' }}
          />
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontFamily: mono,
                fontWeight: 700,
                letterSpacing: 6,
                fontSize: 24,
                color: colors.inkSoft,
              }}
            >
              PLAY FREE AT
            </div>
            <div
              style={{
                fontFamily: display,
                fontWeight: 900,
                fontSize: 74,
                lineHeight: 0.9,
                color: colors.ink,
                letterSpacing: -1,
              }}
            >
              glorydraw<span style={{ color: colors.red }}>.online</span>
            </div>
            {/* tournament color underline */}
            <div style={{ display: 'flex', height: 8, marginTop: 6, borderRadius: 4, overflow: 'hidden', width: 460 }}>
              <div style={{ flex: 1, background: colors.green }} />
              <div style={{ flex: 1, background: colors.gold }} />
              <div style={{ flex: 1, background: colors.red }} />
              <div style={{ flex: 1, background: colors.blue }} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Paper>
  );
};
