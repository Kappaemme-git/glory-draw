import React from 'react';
import { AbsoluteFill } from 'remotion';
import { colors } from '../theme';

// Cream "printed paper" background with halftone dots + a bottom tournament
// color bar — the signature look of the site.
export const Paper: React.FC<{
  children?: React.ReactNode;
  showBar?: boolean;
}> = ({ children, showBar = true }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper }}>
      {/* halftone dots */}
      <AbsoluteFill
        style={{
          opacity: 0.07,
          backgroundImage: `radial-gradient(${colors.ink} 1.4px, transparent 1.8px)`,
          backgroundSize: '11px 11px',
        }}
      />
      {/* soft vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 80% at 50% 35%, transparent 55%, rgba(33,27,22,0.10) 100%)',
        }}
      />
      {children}
      {showBar && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 16,
            display: 'flex',
          }}
        >
          <div style={{ flex: 1, background: colors.green }} />
          <div style={{ flex: 1, background: colors.gold }} />
          <div style={{ flex: 1, background: colors.red }} />
          <div style={{ flex: 1, background: colors.blue }} />
        </div>
      )}
    </AbsoluteFill>
  );
};
