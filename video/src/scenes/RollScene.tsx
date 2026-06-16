import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { FeatureScene } from './FeatureScene';
import { SoccerBall } from '../components/SoccerBall';
import { colors } from '../theme';

export const RollScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <FeatureScene
      kicker="STEP 01 · ROLL"
      accent={colors.green}
      title={
        <>
          A random nation <span style={{ color: colors.green }}>+ year</span>
        </>
      }
      src="screens/draft.png"
      cardWidth={960}
      rotate={-2}
      overlay={() => (
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -30,
            transform: `rotate(${interpolate(frame, [0, 105], [0, 220])}deg)`,
            filter: 'drop-shadow(0 12px 16px rgba(33,27,22,0.4))',
          }}
        >
          <SoccerBall size={140} />
        </div>
      )}
    />
  );
};
