// Shared visual identity — matches the Glory Draw site (retro Panini / poster).
export const colors = {
  paper: '#ece5d5',
  paper2: '#fbf8f0',
  paper3: '#f3eee1',
  ink: '#211b16',
  inkSoft: '#7b7060',
  green: '#0f8a4d',
  red: '#e23120',
  blue: '#1f5fd0',
  gold: '#f3b51b',
};

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 660, // 22s
};

// Scene boundaries (in frames) for the main composition.
export const scenes = {
  intro: { from: 0, durationInFrames: 90 },
  concept: { from: 90, durationInFrames: 105 },
  roll: { from: 195, durationInFrames: 105 },
  pick: { from: 300, durationInFrames: 120 },
  simulate: { from: 420, durationInFrames: 135 },
  outro: { from: 555, durationInFrames: 105 },
};
