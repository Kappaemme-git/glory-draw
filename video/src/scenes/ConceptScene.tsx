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
import { display, mono, sans } from '../fonts';

const steps = [
  { n: '01', label: 'ROLL', color: colors.green, text: 'A random nation + year' },
  { n: '02', label: 'PICK', color: colors.blue, text: 'One legend at a time' },
  { n: '03', label: 'SIM', color: colors.red, text: 'Live your World Cup' },
];

export const ConceptScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const head = spring({ frame, fps, config: { damping: 16 } });
  const card = spring({ frame: frame - 10, fps, config: { damping: 18 } });

  return (
    <Paper>
      <AbsoluteFill
        style={{ flexDirection: 'row', alignItems: 'center', padding: '0 90px', gap: 56 }}
      >
        {/* left: copy + steps */}
        <div style={{ width: 780, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              letterSpacing: 6,
              fontSize: 26,
              color: colors.inkSoft,
              opacity: head,
            }}
          >
            WHAT IS GLORY DRAW
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: display,
              fontWeight: 900,
              textTransform: 'uppercase',
              fontSize: 92,
              lineHeight: 0.84,
              color: colors.ink,
              opacity: head,
              transform: `translateY(${interpolate(head, [0, 1], [40, 0])}px)`,
            }}
          >
            Draft a dream XI from{' '}
            <span style={{ color: colors.red }}>70 years</span> of World Cups
          </div>

          <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((s, i) => {
              const sp = spring({ frame: frame - 24 - i * 8, fps, config: { damping: 14 } });
              return (
                <div
                  key={s.n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    background: colors.paper2,
                    border: `3px solid ${colors.ink}`,
                    borderRadius: 16,
                    padding: '16px 22px',
                    opacity: sp,
                    transform: `translateX(${interpolate(sp, [0, 1], [-40, 0])}px)`,
                    boxShadow: '0 14px 26px -16px rgba(33,27,22,0.5)',
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: s.color,
                      color: colors.paper2,
                      fontFamily: mono,
                      fontWeight: 700,
                      fontSize: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div style={{ fontFamily: display, fontWeight: 900, fontSize: 40, color: colors.ink }}>
                      {s.label}
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 24, color: colors.inkSoft }}>
                      {s.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* right: home screenshot */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: card,
            transform: `translateX(${interpolate(card, [0, 1], [100, 0])}px)`,
          }}
        >
          <ScreenCard src="screens/home.png" width={1020} rotate={2} />
        </div>
      </AbsoluteFill>
    </Paper>
  );
};
