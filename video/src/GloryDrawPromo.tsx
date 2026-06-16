import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { scenes } from './theme';
import { IntroScene } from './scenes/IntroScene';
import { ConceptScene } from './scenes/ConceptScene';
import { RollScene } from './scenes/RollScene';
import { PickScene } from './scenes/PickScene';
import { SimulateScene } from './scenes/SimulateScene';
import { OutroScene } from './scenes/OutroScene';

const Sfx: React.FC<{ at: number; file: string; volume?: number }> = ({
  at,
  file,
  volume = 0.6,
}) => (
  <Sequence from={at} durationInFrames={60}>
    <Audio src={staticFile(`sfx/${file}`)} volume={volume} />
  </Sequence>
);

// bounce SFX frames in the outro (arc starts relative to outro.from)
const bounceFrames = [0, 18, 33, 45, 54].map((f) => scenes.outro.from + f);

export const GloryDrawPromo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={scenes.intro.from} durationInFrames={scenes.intro.durationInFrames}>
        <IntroScene />
      </Sequence>
      <Sequence from={scenes.concept.from} durationInFrames={scenes.concept.durationInFrames}>
        <ConceptScene />
      </Sequence>
      <Sequence from={scenes.roll.from} durationInFrames={scenes.roll.durationInFrames}>
        <RollScene />
      </Sequence>
      <Sequence from={scenes.pick.from} durationInFrames={scenes.pick.durationInFrames}>
        <PickScene />
      </Sequence>
      <Sequence from={scenes.simulate.from} durationInFrames={scenes.simulate.durationInFrames}>
        <SimulateScene />
      </Sequence>
      <Sequence from={scenes.outro.from} durationInFrames={scenes.outro.durationInFrames}>
        <OutroScene />
      </Sequence>

      {/* audio */}
      <Sfx at={6} file="whistle.wav" volume={0.5} />
      <Sfx at={scenes.concept.from} file="swoosh.wav" volume={0.4} />
      <Sfx at={scenes.roll.from} file="swoosh.wav" volume={0.4} />
      <Sfx at={scenes.pick.from} file="swoosh.wav" volume={0.4} />
      <Sfx at={scenes.simulate.from} file="whistle.wav" volume={0.45} />
      <Sfx at={scenes.outro.from} file="swoosh.wav" volume={0.4} />
      {bounceFrames.map((f, i) => (
        <Sfx key={i} at={f} file="bounce.wav" volume={0.55} />
      ))}
    </AbsoluteFill>
  );
};
