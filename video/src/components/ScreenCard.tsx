import React from 'react';
import { Img, staticFile } from 'remotion';
import { colors } from '../theme';

// A screenshot framed like a monitor/laptop screen: thin dark bezel hugging
// the screen (no big gap), rounded corners, printed drop-shadow.
export const ScreenCard: React.FC<{
  src: string;
  width: number;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ src, width, rotate = 0, style }) => {
  return (
    <div
      style={{
        width,
        padding: 10,
        background: colors.ink,
        borderRadius: 20,
        boxShadow: '0 30px 64px -18px rgba(33,27,22,0.6)',
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          display: 'block',
          borderRadius: 10,
        }}
      />
    </div>
  );
};
