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

// Landscape (16:9) step scene: text column on the left, a large tilted
// screenshot on the right — fills the frame like a desktop view.
export const FeatureScene: React.FC<{
  kicker: string;
  title: React.ReactNode;
  accent: string;
  src: string;
  cardWidth?: number;
  rotate?: number;
  overlay?: (cardWidth: number) => React.ReactNode;
}> = ({ kicker, title, accent, src, cardWidth = 1080, rotate = -2, overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const head = spring({ frame, fps, config: { damping: 16 } });
  const card = spring({ frame: frame - 8, fps, config: { damping: 18, mass: 1.1 } });

  return (
    <Paper>
      <AbsoluteFill
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 90px',
          gap: 50,
        }}
      >
        {/* left: text */}
        <div style={{ width: 720, flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              background: accent,
              color: colors.paper2,
              fontFamily: mono,
              fontWeight: 700,
              letterSpacing: 5,
              fontSize: 28,
              padding: '12px 22px',
              borderRadius: 999,
              opacity: head,
              transform: `translateY(${interpolate(head, [0, 1], [-20, 0])}px)`,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: display,
              fontWeight: 900,
              textTransform: 'uppercase',
              fontSize: 116,
              lineHeight: 0.86,
              color: colors.ink,
              opacity: head,
              transform: `translateY(${interpolate(head, [0, 1], [40, 0])}px)`,
            }}
          >
            {title}
          </div>
        </div>

        {/* right: screenshot */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: card,
            transform: `translateX(${interpolate(card, [0, 1], [120, 0])}px)`,
          }}
        >
          <div style={{ position: 'relative' }}>
            <ScreenCard src={src} width={cardWidth} rotate={rotate} />
            {overlay?.(cardWidth)}
          </div>
        </div>
      </AbsoluteFill>
    </Paper>
  );
};
