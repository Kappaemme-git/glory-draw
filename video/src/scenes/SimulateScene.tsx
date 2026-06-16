import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Paper } from '../components/Paper';
import { ScreenCard } from '../components/ScreenCard';
import { colors } from '../theme';
import { display, mono } from '../fonts';

export const SimulateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const head = spring({ frame, fps, config: { damping: 16 } });
  const liveIn = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const toResult = interpolate(frame, [82, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Paper>
      <AbsoluteFill
        style={{ flexDirection: 'row', alignItems: 'center', padding: '0 90px', gap: 50 }}
      >
        <div style={{ width: 720, flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              background: colors.red,
              color: colors.paper2,
              fontFamily: mono,
              fontWeight: 700,
              letterSpacing: 5,
              fontSize: 28,
              padding: '12px 22px',
              borderRadius: 999,
              opacity: head,
            }}
          >
            STEP 03 · SIMULATE
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: display,
              fontWeight: 900,
              textTransform: 'uppercase',
              fontSize: 112,
              lineHeight: 0.84,
              color: colors.ink,
              opacity: head,
              transform: `translateY(${interpolate(head, [0, 1], [40, 0])}px)`,
            }}
          >
            Live it <span style={{ color: colors.red }}>minute by minute</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: liveIn,
            transform: `translateX(${interpolate(liveIn, [0, 1], [120, 0])}px)`,
          }}
        >
          <div style={{ position: 'relative', width: 1040, height: 660 }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - toResult }}>
              <ScreenCard src="screens/live.png" width={1040} rotate={-2} />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: toResult,
                transform: `scale(${interpolate(toResult, [0, 1], [0.96, 1])}) rotate(2deg)`,
              }}
            >
              <ScreenCard src="screens/result.png" width={1040} rotate={0} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Paper>
  );
};
