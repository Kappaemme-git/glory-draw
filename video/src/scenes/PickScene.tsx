import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { FeatureScene } from './FeatureScene';
import { colors } from '../theme';

export const PickScene: React.FC = () => {
  const frame = useCurrentFrame();
  // pulsing highlight ring over the (red) goalkeeper slot in pick.png
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  const ringScale = 1 + pulse * 0.18;

  return (
    <FeatureScene
      kicker="STEP 02 · PICK"
      accent={colors.blue}
      title={
        <>
          Pick <span style={{ color: colors.blue }}>legends</span> one by one
        </>
      }
      src="screens/pick.png"
      cardWidth={960}
      rotate={2}
      overlay={(cardWidth) => {
        // image sits inside 12px padding; approximate GK slot position
        const innerW = cardWidth - 20;
        const innerH = innerW * (854 / 1366);
        const cx = 10 + innerW * 0.5;
        const cy = 10 + innerH * 0.8;
        return (
          <div
            style={{
              position: 'absolute',
              left: cx - 70,
              top: cy - 70,
              width: 140,
              height: 140,
              borderRadius: 999,
              border: `6px solid ${colors.gold}`,
              boxShadow: `0 0 0 4px rgba(243,181,27,0.35)`,
              transform: `scale(${ringScale})`,
              opacity: interpolate(frame, [10, 24], [0, 1], {
                extrapolateRight: 'clamp',
              }),
            }}
          />
        );
      }}
    />
  );
};
