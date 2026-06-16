import React from 'react';
import { Composition } from 'remotion';
import { GloryDrawPromo } from './GloryDrawPromo';
import { VIDEO } from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GloryDrawPromo"
      component={GloryDrawPromo}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
