import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Dices, Github, Play, RotateCcw, Share2, Trophy, UsersRound, Wand2 } from 'lucide-react';
import { flagFor } from './flags';
import { autoDraft, createDraft, isComplete, pickPlayer, removePick, rerollRoster, rollRoster } from './engine/draft';
import { defaultFormation, formations } from './engine/formations';
import { eligibleSlots, ratingsFromPicks, slotById } from './engine/ratings';
import { simulateWorldCup } from './engine/simulate';
import type { Dataset, DraftState, GroupStanding, MatchEvent, MatchResult, Player, Position, SimulationResult, Slot } from './types';

const positionLabels: Record<string, string> = {
  GK: 'GK',
  RB: 'RB',
  LB: 'LB',
  CB: 'CB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  RM: 'RM',
  LM: 'LM',
  RW: 'RW',
  LW: 'LW',
  ST: 'ST',
};

const positionOrder: Record<Position, number> = {
  GK: 0,
  RB: 1,
  LB: 2,
  CB: 3,
  DM: 4,
  CM: 5,
  AM: 6,
  RM: 7,
  LM: 8,
  RW: 9,
  LW: 10,
  ST: 11,
};

function roleSortValue(player: Player): number {
  return Math.min(...player.positions.map((position) => positionOrder[position]));
}

function Logo({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="logo-word">
        <strong>Glory</strong>
        <em>Draw</em>
      </span>
      <span className="logo-years">1950 · 2026</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`logo logo-button ${className}`.trim()} onClick={onClick} aria-label="Glory Draw — back to home">
        {inner}
      </button>
    );
  }
  return (
    <span className={`logo ${className}`.trim()} aria-label="Glory Draw">
      {inner}
    </span>
  );
}

function playWhistle() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.connect(ctx.destination);

    // referee pea-whistle: high tone with a fast warble
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2280, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(22, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(130, now);
    lfo.connect(lfoGain).connect(osc.frequency);

    osc.connect(master);

    const peak = 0.16;
    master.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    master.gain.setValueAtTime(peak, now + 0.34);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.48);
    lfo.stop(now + 0.48);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — ignore */
  }
}

export function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [draft, setDraft] = useState<DraftState>(() => createDraft(defaultFormation));
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [started, setStarted] = useState(false);
  const [rolling, setRolling] = useState(false);

  function startRolling() {
    setRolling(true);
    window.setTimeout(() => setRolling(false), 550);
  }

  useEffect(() => {
    fetch('/data/worldcup-rosters.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Dataset non trovato: HTTP ${res.status}`);
        return res.json();
      })
      .then(setDataset)
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const rosters = dataset?.rosters ?? [];
  const nations = useMemo(() => {
    const map = new Map<string, string>();
    for (const roster of rosters) if (!map.has(roster.teamCode)) map.set(roster.teamCode, roster.teamName);
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rosters]);
  const ratings = useMemo(() => ratingsFromPicks(draft.formation, draft.picks), [draft]);
  const slots = formations[draft.formation];
  const pickedBySlot = new Map(draft.picks.map((pick) => [pick.slotId, pick]));
  const pickedTeamCodes = new Set(draft.picks.map((pick) => pick.sourceRoster.teamCode));
  const currentRoster = draft.currentRoster;
  const teamRerolls = currentRoster
    ? rosters.filter(
        (roster) =>
          roster.id !== currentRoster.id &&
          roster.year === currentRoster.year &&
          !pickedTeamCodes.has(roster.teamCode)
      ).length
    : 0;
  const yearRerolls = currentRoster
    ? rosters.filter((roster) => roster.id !== currentRoster.id && roster.teamCode === currentRoster.teamCode).length
    : 0;
  const canReroll = draft.rerollsLeft > 0;

  const rosterRows = useMemo(() => {
    if (!draft.currentRoster) return [];
    const usedPlayerIds = new Set(draft.picks.map((pick) => pick.player.playerId));
    return draft.currentRoster.players
      .filter((player) => !usedPlayerIds.has(player.playerId))
      .map((player) => ({
        player,
        slots: eligibleSlots(draft.formation, draft.picks, player),
      }))
      .sort(
        (a, b) =>
          roleSortValue(a.player) - roleSortValue(b.player) ||
          a.player.shirtNumber - b.player.shirtNumber ||
          a.player.displayName.localeCompare(b.player.displayName)
      );
  }, [draft]);
  const compatiblePlayers = rosterRows.filter((row) => row.slots.length > 0).length;

  function scrollToPanel(selector: string) {
    if (window.innerWidth > 720) return;
    window.setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function startGame() {
    setStarted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setDraft(createDraft(draft.formation));
    setSelectedPlayer(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goHome() {
    setStarted(false);
    setResult(null);
    setSelectedPlayer(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function autoBuild() {
    if (!dataset) return;
    setSelectedPlayer(null);
    setResult(null);
    setDraft(autoDraft(createDraft(draft.formation), dataset.rosters));
    setStarted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function autoFill() {
    if (!dataset) return;
    setSelectedPlayer(null);
    setDraft((state) => autoDraft(state, dataset.rosters));
  }

  function changeFormation(formation: string) {
    setDraft(createDraft(formation));
    setSelectedPlayer(null);
    setResult(null);
  }

  function roll() {
    if (!dataset) return;
    setSelectedPlayer(null);
    startRolling();
    setDraft((state) => rollRoster(state, dataset.rosters));
  }

  function reroll(axis: 'team' | 'year') {
    if (!dataset) return;
    setSelectedPlayer(null);
    startRolling();
    setDraft((state) => rerollRoster(state, dataset.rosters, axis));
  }

  function choosePlayer(player: Player, slot?: Slot) {
    if (!dataset) return;
    if (draft.picks.length < 10) startRolling();
    setDraft((state) => {
      const next = pickPlayer(state, player, slot?.id);
      if (next.picks.length === state.picks.length || isComplete(next)) return next;
      return rollRoster(next, dataset.rosters);
    });
    setSelectedPlayer(null);
    scrollToPanel('.roll-panel');
  }

  function selectPlayer(player: Player) {
    setSelectedPlayer(player);
    scrollToPanel('.pitch-panel');
  }

  function simulate() {
    if (!dataset || !isComplete(draft)) return;
    setResult(simulateWorldCup(draft.formation, draft.picks, dataset.rosters));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!dataset) {
    return (
      <main className="app-shell loading">
        <p>Loading World Cup squads...</p>
        <p className="muted">If it stays here, run `npm run import:data` first.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {started ? (
        <header className="gamebar">
          <Logo onClick={goHome} />
        </header>
      ) : (
        <header className="topbar">
          <span className="hero-sun-glow" aria-hidden="true" />
          <img className="hero-sun-logo" src="/glory-draw-logo.png" alt="" aria-hidden="true" />
          <div className="hero-main">
            <Logo className="hero-logo" />
            <h1>
              Draft your <span className="grad">XI</span>
            </h1>
            <p className="tagline">
              Roll squads. Pick legends. Chase the Cup.
            </p>
            <div className="dataset-stats">
              <div className="stat">
                <strong>{dataset.counts.rosters}</strong>
                <span>squads</span>
              </div>
              <div className="stat">
                <strong>{dataset.counts.players}</strong>
                <span>players</span>
              </div>
              <div className="stat">
                <strong>{dataset.counts.teams}</strong>
                <span>nations</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {result ? (
        <ResultView result={result} draft={draft} onRestart={() => reset()} />
      ) : !started ? (
        <LandingView
          formation={draft.formation}
          nations={nations}
          onStart={startGame}
          onAuto={autoBuild}
        />
      ) : (
        <>
          <section className="control-band">
            <button className="ghost-btn back-btn" type="button" onClick={goHome}>
              <ArrowLeft size={16} />
              Back
            </button>
            <div className="formation-tabs" aria-label="Formation">
              {Object.keys(formations).map((formation) => (
                <button
                  key={formation}
                  className={draft.formation === formation ? 'active' : ''}
                  type="button"
                  onClick={() => changeFormation(formation)}
                >
                  {formation}
                </button>
              ))}
            </div>
            <div className="control-actions">
              <button className="ghost-btn" type="button" onClick={autoFill} disabled={isComplete(draft)}>
                <Dices size={16} />
                Auto-fill XI
              </button>
              <button className="ghost-btn" type="button" onClick={() => reset()}>
                <RotateCcw size={16} />
                New game
              </button>
            </div>
          </section>

          <section className="game-grid">
            <aside className="roll-panel">
              <div className="roll-card">
                {rolling && (
                  <span className="dice-roll" aria-hidden="true">
                    <Dices size={22} />
                  </span>
                )}
                {draft.currentRoster ? (
                  <>
                    <p className="eyebrow">Roll #{draft.rollIndex}</p>
                    <h2 className="roll-title">
                      <span className="roll-flag">{flagFor(draft.currentRoster.teamCode)}</span>
                      <span>
                        {draft.currentRoster.teamName} {draft.currentRoster.year}
                      </span>
                    </h2>
                    <div className="roster-meta">
                      <span>Strength {draft.currentRoster.strength}</span>
                      <span>{draft.currentRoster.performance}</span>
                      <span>{draft.currentRoster.players.length} players</span>
                      <span>{draft.rerollsLeft} rerolls left</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Next roll</p>
                    <h2>{isComplete(draft) ? 'Squad complete' : 'Roll nation + year'}</h2>
                    <p className="muted">
                      You'll also get weak squads: the game is finding the right pick to complete your XI.
                    </p>
                  </>
                )}
              </div>

              {!isComplete(draft) ? (
                draft.currentRoster ? (
                  <div className="reroll-actions">
                    <button
                      className="primary-btn"
                      type="button"
                      onClick={() => reroll('team')}
                      disabled={!canReroll || teamRerolls === 0}
                    >
                      <UsersRound size={18} />
                      Another nation, same year
                    </button>
                    <button
                      className="secondary-action"
                      type="button"
                      onClick={() => reroll('year')}
                      disabled={!canReroll || yearRerolls === 0}
                    >
                      <CalendarDays size={17} />
                      Same nation, different year
                    </button>
                    <p className="reroll-note">
                      {canReroll
                        ? `Pick a player and the next roll is free. Changing nation or year costs 1 reroll.`
                        : 'No rerolls left: you must pick a player from this roll.'}
                    </p>
                  </div>
                ) : (
                  <button className="primary-btn" type="button" onClick={roll}>
                    <Dices size={19} />
                    Roll
                  </button>
                )
              ) : (
                <button className="primary-btn gold" type="button" onClick={simulate}>
                  <Trophy size={19} />
                  Simulate World Cup
                </button>
              )}

              {draft.currentRoster && (
                <div className="player-list">
                  <div className="list-head">
                    <span>Rolled squad</span>
                    <span>{compatiblePlayers}/{rosterRows.length} available</span>
                  </div>
                  {rosterRows.slice(0, 26).map(({ player, slots }) => {
                    const unavailable = slots.length === 0;
                    return (
                    <button
                      key={player.id}
                      className={[
                        'player-row',
                        selectedPlayer?.id === player.id ? 'selected' : '',
                        unavailable ? 'unavailable' : '',
                      ].join(' ')}
                      type="button"
                      disabled={unavailable}
                      onClick={() => {
                        selectPlayer(player);
                      }}
                    >
                      <span className="shirt">{player.shirtNumber || '-'}</span>
                      <span className="player-main">
                        <strong>{player.displayName}</strong>
                        <small>
                          {player.positions.map((pos) => positionLabels[pos]).join('/')} ·{' '}
                          {unavailable ? 'role filled' : `${slots.length} slots`}
                        </small>
                      </span>
                      <span className={`overall ${overallTier(player.overall)}`.trim()}>{player.overall}</span>
                    </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="pitch-panel">
              <div className="pitch">
                {slots.map((slot) => {
                  const pick = pickedBySlot.get(slot.id);
                  const canReceive = selectedPlayer
                    ? eligibleSlots(draft.formation, draft.picks, selectedPlayer).some((candidate) => candidate.id === slot.id)
                    : false;

                  return (
                    <button
                      key={slot.id}
                      className={[
                        'slot',
                        pick ? 'filled' : '',
                        canReceive ? 'target' : '',
                      ].join(' ')}
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      type="button"
                      onClick={() => {
                        if (selectedPlayer) {
                          if (canReceive) choosePlayer(selectedPlayer, slot);
                          return;
                        }
                        if (pick) setDraft((state) => removePick(state, slot.id));
                      }}
                    >
                      <span className="disc">{pick ? pick.player.overall : slot.label}</span>
                      <span className="slot-name">{pick ? pick.player.displayName : positionLabels[slot.position]}</span>
                      {pick && (
                        <small>
                          {flagFor(pick.sourceRoster.teamCode)} {pick.sourceRoster.teamCode} {pick.sourceRoster.year}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedPlayer && (
                <div className="selection-hint">
                  <Wand2 size={16} />
                  Pick a highlighted slot for {selectedPlayer.displayName}
                </div>
              )}
            </section>

            <aside className="lineup-panel">
              <div className="rating-box">
                <span>
                  <b>{ratings.overall || '-'}</b> overall
                </span>
                <span>
                  <b>{ratings.attack || '-'}</b> attack
                </span>
                <span>
                  <b>{ratings.defense || '-'}</b> defense
                </span>
              </div>
              <h2>Lineup {draft.picks.length}/11</h2>
              <div className="lineup-list">
                {slots.map((slot) => {
                  const pick = pickedBySlot.get(slot.id);
                  const canReceive = selectedPlayer
                    ? eligibleSlots(draft.formation, draft.picks, selectedPlayer).some((candidate) => candidate.id === slot.id)
                    : false;
                  return (
                    <button
                      className={[
                        'lineup-row',
                        pick ? '' : 'empty',
                        canReceive ? 'target' : '',
                      ].join(' ')}
                      key={slot.id}
                      type="button"
                      disabled={selectedPlayer ? !canReceive : !pick}
                      onClick={() => {
                        if (selectedPlayer && canReceive) choosePlayer(selectedPlayer, slot);
                        else if (pick) setDraft((state) => removePick(state, slot.id));
                      }}
                    >
                      <span>{positionLabels[slot.position]}</span>
                      <strong>{pick ? pick.player.displayName : 'empty'}</strong>
                      <small>
                        {pick
                          ? `${flagFor(pick.sourceRoster.teamCode)} ${pick.sourceRoster.teamCode} ${pick.sourceRoster.year}`
                          : slot.label}
                      </small>
                    </button>
                  );
                })}
              </div>
            </aside>
          </section>
        </>
      )}

      {!started && (
        <footer className="source-note">
          <span>Created by @Kappaemme</span>
          <a href="https://github.com/Kappaemme-git" target="_blank" rel="noreferrer" aria-label="Kappaemme on GitHub">
            <Github size={15} />
            GitHub
          </a>
          <a href="https://x.com/Kappaemme1926" target="_blank" rel="noreferrer" aria-label="Kappaemme on X">
            <b aria-hidden="true">X</b>
          </a>
        </footer>
      )}
    </main>
  );
}

function LandingView({
  formation,
  nations,
  onStart,
  onAuto,
}: {
  formation: string;
  nations: { code: string; name: string }[];
  onStart: () => void;
  onAuto: () => void;
}) {
  const slots = formations[formation];
  const steps = [
    {
      icon: <Dices size={18} />,
      title: 'Roll',
      text: 'A random nation + year shows up, from 1950 to today.',
    },
    {
      icon: <Wand2 size={18} />,
      title: 'Pick',
      text: 'Take one player from that squad and place him in his role.',
    },
    {
      icon: <Trophy size={18} />,
      title: 'Simulate',
      text: 'Complete your XI and live your World Cup minute by minute.',
    },
  ];

  // raddoppio la lista per uno scorrimento continuo e senza stacchi
  const marquee = [...nations, ...nations];

  return (
    <section className="landing">
      <div className="landing-grid">
        <div className="landing-copy">
          <p className="eyebrow">How it plays</p>
          <div className="steps">
            {steps.map((step, index) => (
              <div className="step" key={step.title}>
                <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>
                    {step.title}
                    {step.icon}
                  </strong>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="landing-actions">
            <button className="primary-btn gold start-btn" type="button" onClick={onStart}>
              <Play size={19} />
              Play
            </button>
            <button className="secondary-action auto-btn" type="button" onClick={onAuto}>
              <Dices size={18} />
              Random XI
            </button>
          </div>
          <p className="muted landing-note">
            Single player · {nations.length} nations · no account, play instantly.
          </p>
        </div>

        <div className="landing-pitch-wrap">
          <p className="pitch-caption">Your XI · {formation} formation</p>
          <div className="pitch mini" aria-hidden="true">
            {slots.map((slot) => (
              <div className="slot static" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} key={slot.id}>
                <span className="disc">{positionLabels[slot.position]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nations-bar">
        <div className="nations-head">
          <span className="flag-dot">●</span>
          Every World Cup nation · 1950 → 2026
        </div>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {marquee.map((nation, index) => (
              <span className="nation-pill" key={`${nation.code}-${index}`}>
                <span className="flag">{flagFor(nation.code)}</span>
                {nation.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultView({
  result,
  draft,
  onRestart,
}: {
  result: SimulationResult;
  draft: DraftState;
  onRestart: () => void;
}) {
  const timeline = useMemo(() => {
    const starts: number[] = [];
    const durations = result.matches.map(matchDuration);
    let total = 0;
    for (const duration of durations) {
      starts.push(total);
      total += duration;
    }
    return { starts, durations, total };
  }, [result]);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [playMode, setPlayMode] = useState<'auto' | 'manual'>('auto');
  const [isRunning, setIsRunning] = useState(true);
  const [liveMinute, setLiveMinute] = useState(0);
  const [shareStatus, setShareStatus] = useState<'idle' | 'building' | 'shared' | 'copied'>('idle');
  const finished = liveMinute >= timeline.total;
  const activeIndexRaw = result.matches.findIndex((_, index) => liveMinute < timeline.starts[index] + timeline.durations[index]);
  const activeIndex = activeIndexRaw === -1 ? Math.max(0, result.matches.length - 1) : activeIndexRaw;
  const activeMatch = result.matches[activeIndex];
  const activeElapsed = finished
    ? timeline.durations[activeIndex]
    : Math.max(0, Math.min(timeline.durations[activeIndex], liveMinute - timeline.starts[activeIndex]));
  const activeScore = scoreAt(activeMatch, activeElapsed);
  const activeShootoutScore = penaltyScoreAt(activeMatch, activeElapsed);
  // running record of matches fully played so far (no spoiler of how far you go)
  const playedSoFar = result.matches.slice(0, activeIndex);
  const liveWins = playedSoFar.filter((m) => (m.penalties ? m.penalties.won : m.gf > m.ga)).length;
  const liveDraws = playedSoFar.filter((m) => !m.penalties && m.gf === m.ga).length;
  const liveLosses = playedSoFar.filter((m) => (m.penalties ? !m.penalties.won : m.gf < m.ga)).length;
  const liveRecord = `${liveWins}-${liveDraws}-${liveLosses}`;
  const visibleEvents = activeMatch.events.filter((event) => event.minute <= activeElapsed);
  const halftimeScore = scoreAt(activeMatch, 45);
  const currentMatchEnd = Math.min(timeline.total, timeline.starts[activeIndex] + timeline.durations[activeIndex]);
  const groupPhaseEnd = timeline.starts[2] + timeline.durations[2];
  const groupComplete = finished || liveMinute >= groupPhaseEnd;
  const visibleGroupTable = groupStandingsAt(result, liveMinute, timeline.starts, timeline.durations, finished);
  const kickoffTrackRef = useRef(-1);
  const goalTrackRef = useRef({ index: -1, count: 0 });

  useEffect(() => {
    setLiveMinute(0);
    setSpeed(1);
    setPlayMode('auto');
    setIsRunning(true);
    setShareStatus('idle');
    kickoffTrackRef.current = -1;
    goalTrackRef.current = { index: -1, count: 0 };
  }, [result]);

  useEffect(() => {
    if (playMode !== 'manual' || finished || liveMinute === 0) return;
    if (timeline.starts.includes(liveMinute)) setIsRunning(false);
  }, [finished, liveMinute, playMode, timeline.starts]);

  useEffect(() => {
    if (finished || !isRunning || activeElapsed !== 0) return;
    if (kickoffTrackRef.current === activeIndex) return;
    playWhistle();
    kickoffTrackRef.current = activeIndex;
  }, [activeIndex, activeElapsed, finished, isRunning]);

  useEffect(() => {
    const goals = activeMatch.events.filter((event) => event.kind === 'goal' && event.minute <= activeElapsed);
    const prev = goalTrackRef.current;
    if (activeIndex === prev.index && isRunning && goals.length > prev.count) {
      const fresh = goals.slice(prev.count);
      playGoal(fresh.some((g) => g.team === 'you') ? 'you' : 'opponent');
    }
    goalTrackRef.current = { index: activeIndex, count: goals.length };
  }, [activeIndex, activeElapsed, isRunning, activeMatch]);

  useEffect(() => {
    if (finished || timeline.total <= 0 || !isRunning) return;
    const timer = window.setInterval(
      () =>
        setLiveMinute((minute) => {
          const index = result.matches.findIndex((_, matchIndex) => minute < timeline.starts[matchIndex] + timeline.durations[matchIndex]);
          const safeIndex = index === -1 ? Math.max(0, result.matches.length - 1) : index;
          const matchEnd = timeline.starts[safeIndex] + timeline.durations[safeIndex];
          const nextMinute = Math.min(timeline.total, minute + 1);
          return playMode === 'manual' ? Math.min(nextMinute, matchEnd) : nextMinute;
        }),
      speed === 2 ? 95 : 215
    );
    return () => window.clearInterval(timer);
  }, [finished, isRunning, playMode, result.matches, speed, timeline]);

  function changePlayMode(mode: 'auto' | 'manual') {
    setPlayMode(mode);
    setIsRunning(mode === 'auto');
  }

  function skipCurrentMatch() {
    setLiveMinute(currentMatchEnd);
    setIsRunning(playMode === 'auto' && currentMatchEnd < timeline.total);
  }

  function startManualMatch() {
    if (!finished) setIsRunning(true);
  }

  async function shareResultCard() {
    try {
      setShareStatus('building');
      const file = await createShareCardFile(result, draft);
      const text = buildShareText(result, draft);
      const title = result.champion ? 'Glory Draw - World Champions' : `Glory Draw - Out: ${result.eliminatedPhase}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        setShareStatus('shared');
      } else if (navigator.share) {
        await navigator.share({ title, text });
        setShareStatus('shared');
      } else {
        await copyToClipboard(text);
        setShareStatus('copied');
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        await copyToClipboard(buildShareText(result, draft));
        setShareStatus('copied');
      } else {
        setShareStatus('idle');
      }
    } finally {
      window.setTimeout(() => setShareStatus('idle'), 1800);
    }
  }

  return (
    <section className="result-grid">
      <div className={finished && result.champion ? 'result-hero champion' : finished ? 'result-hero' : 'result-hero pending'}>
        <p className="eyebrow">{finished ? 'World Cup result' : 'World Cup · in progress'}</p>
        <h2>{finished ? (result.champion ? 'World Champions' : `Out: ${result.eliminatedPhase}`) : 'Live simulation'}</h2>
        {finished ? (
          <div className="big-record">{result.record}</div>
        ) : (
          <div className="big-record pending-record">{liveRecord}</div>
        )}
        {!finished && <p className="progress-line">Now playing · {phaseLabel(activeMatch.phase)}</p>}
        <div className="progress-pips">
          {result.matches.map((match, index) => {
            if (!finished && index > activeIndex) return null;
            const done = finished || index < activeIndex;
            const now = !finished && index === activeIndex;
            const won = match.penalties ? match.penalties.won : match.gf > match.ga;
            const lost = match.penalties ? !match.penalties.won : match.gf < match.ga;
            const state = done ? (won ? 'win' : lost ? 'loss' : 'draw') : now ? 'now' : 'next';
            return <span key={`pip-${index}`} className={`pip pip-${state}`} title={phaseLabel(match.phase)} />;
          })}
        </div>
        <div className="result-stats">
          <span>{finished ? `${result.gf} goals for` : `OVR ${result.ratings.overall}`}</span>
          <span>{finished ? `${result.ga} against` : `ATT ${result.ratings.attack}`}</span>
          <span>{finished ? `OVR ${result.ratings.overall}` : `DEF ${result.ratings.defense}`}</span>
        </div>
        {finished && (
          <button className="primary-btn" type="button" onClick={onRestart}>
            <RotateCcw size={18} />
            Play again
          </button>
        )}

        <div className="group-card">
          <div className="group-card-head">
            <span>Group standings</span>
            <small>{groupComplete ? `Final · #${result.groupPosition}` : 'Live'}</small>
          </div>
          <div className="group-table">
            <div className="group-row header">
              <span>Team</span>
              <b>PT</b>
              <b>GF</b>
              <b>GA</b>
              <b>GD</b>
            </div>
            {visibleGroupTable.map((row) => (
              <div key={row.id} className={row.you ? 'group-row you' : 'group-row'}>
                <span>{row.label}</span>
                <b>{row.pts}</b>
                <b>{row.gf}</b>
                <b>{row.ga}</b>
                <b>{row.gd}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="campaign">
          <p className="campaign-head">Your road</p>
          {result.matches.map((match, index) => {
            // surprise effect: don't reveal upcoming knockout opponents before you reach them
            if (!finished && index > activeIndex) return null;
            const elapsed = elapsedForMatch(index, liveMinute, timeline.starts[index], timeline.durations[index], finished);
            const played = elapsed >= timeline.durations[index];
            const live = !finished && index === activeIndex;
            const hidden = elapsed <= 0 && !live && !finished;
            const score = scoreLabel(match, elapsed);
            return (
              <article
                key={`${match.phase}-${match.opponent.roster.id}`}
                className={[
                  'match-row',
                  played && !match.advanced ? 'lost' : '',
                  live ? 'live' : '',
                  hidden ? 'pending-match' : '',
                ].join(' ')}
              >
                <span className="m-phase">{phaseLabel(match.phase)}</span>
                <span className="m-opp">
                  <span className="flag">{flagFor(match.opponent.roster.teamCode)}</span>
                  <span className="m-name">
                    {match.opponent.roster.teamName} {match.opponent.roster.year}
                  </span>
                </span>
                <strong className="m-score">{hidden ? '–' : score}</strong>
              </article>
            );
          })}
        </div>
      </div>

      <div className="live-panel">
        <div className="live-top">
          <div>
            <p className="eyebrow">
              {finished ? 'Full time' : playMode === 'manual' && !isRunning ? 'Ready to kick off' : `${phaseLabel(activeMatch.phase)} · live`}
            </p>
            <h2>
              You vs {flagFor(activeMatch.opponent.roster.teamCode)} {activeMatch.opponent.roster.teamName}{' '}
              {activeMatch.opponent.roster.year}
            </h2>
          </div>
          <div className="match-clock">
            <strong>{finished ? 'FT' : `${activeElapsed}'`}</strong>
            <span>{phaseShort(activeMatch.phase)}</span>
          </div>
        </div>

        <div className="live-scoreboard">
          <div>
            <span>Your team</span>
            <strong>{activeScore.gf}</strong>
          </div>
          <div>
            <span>
              {flagFor(activeMatch.opponent.roster.teamCode)} {activeMatch.opponent.roster.teamName}
            </span>
            <strong>{activeScore.ga}</strong>
          </div>
        </div>

        {activeShootoutScore && (
          <div className="shootout-score">
            <span>Penalty shootout</span>
            <strong>{activeShootoutScore}</strong>
          </div>
        )}

        {playMode === 'manual' && !isRunning && !finished && activeElapsed === 0 && (
          <div className="next-opponent-card">
            <span>Next opponent</span>
            <strong>
              {flagFor(activeMatch.opponent.roster.teamCode)} {activeMatch.opponent.roster.teamName}{' '}
              {activeMatch.opponent.roster.year}
            </strong>
            <small>
              OVR {activeMatch.opponent.overall} · ATT {activeMatch.opponent.attack} · DEF {activeMatch.opponent.defense}
            </small>
          </div>
        )}

        <div className="sim-controls">
          <button className={playMode === 'auto' ? 'active' : ''} type="button" onClick={() => changePlayMode('auto')} disabled={finished}>
            Auto
          </button>
          <button className={playMode === 'manual' ? 'active' : ''} type="button" onClick={() => changePlayMode('manual')} disabled={finished}>
            Manual
          </button>
          <button className={speed === 1 ? 'active' : ''} type="button" onClick={() => setSpeed(1)} disabled={finished}>
            1x
          </button>
          <button className={speed === 2 ? 'active' : ''} type="button" onClick={() => setSpeed(2)} disabled={finished}>
            2x
          </button>
          {playMode === 'manual' && (
            <button type="button" onClick={startManualMatch} disabled={finished || isRunning}>
              {activeElapsed > 0 ? 'Resume match' : 'Start match'}
            </button>
          )}
          <button type="button" onClick={skipCurrentMatch} disabled={finished}>
            Skip to match result
          </button>
        </div>

        <div className="event-feed" aria-live="polite">
          {visibleEvents.length > 0 ? (
            visibleEvents.map((event, index) => {
              const prev = visibleEvents[index - 1];
              const showHalftime = event.minute > 45 && (!prev || prev.minute <= 45);
              const showPenalties = event.kind === 'penalties' && (!prev || prev.kind !== 'penalties');
              return (
                <Fragment key={event.id}>
                  {showHalftime && (
                    <div className="ev-half">
                      <span>Half-time</span>
                      <b>{halftimeScore.gf}-{halftimeScore.ga}</b>
                    </div>
                  )}
                  {showPenalties && (
                    <div className="ev-half ev-shootout-start">
                      <span>Penalty shootout</span>
                      <b>{activeMatch.gf}-{activeMatch.ga}</b>
                    </div>
                  )}
                  <MatchEventRow event={event} />
                </Fragment>
              );
            })
          ) : (
            playMode === 'manual' && !isRunning && activeElapsed === 0 && (
              <p className="empty-events">Press Start match.</p>
            )
          )}
        </div>
      </div>

      {finished && (
        <div className={result.champion ? 'share-card champion' : 'share-card'}>
          <div className="share-kicker">
            <span className="share-brand">
              <b>Glory</b>
              <em>Draw</em>
            </span>
            <span>{draft.formation} XI</span>
          </div>

          <div className="share-card-head">
            <div>
              <p className="eyebrow">Final card</p>
              <h3>{result.champion ? 'World Champions' : `Out: ${result.eliminatedPhase}`}</h3>
            </div>
            <div className="share-record">
              <strong>{result.record}</strong>
              <span>W-D-L</span>
            </div>
          </div>

          <div className="share-statbox" aria-label="Run statistics">
            <span>
              <b>{result.ratings.overall}</b>
              Overall
            </span>
            <span>
              <b>{result.gf}</b>
              Goals
            </span>
            <span>
              <b>{result.ga}</b>
              Against
            </span>
            <span>
              <b className="gold">{result.wins}</b>
              Wins
            </span>
          </div>

          <ol className="share-lineup" aria-label="Final XI">
            {shareLineup(draft).map((row) => (
              <li className={`sl-row ${overallTier(row.overall)}`.trim()} key={row.id}>
                <span className="sl-meta">
                  <span className="sl-num">{row.number || '-'}</span>
                  <span className="sl-pos">{row.position}</span>
                </span>
                <span className="sl-name">
                  <span className="sl-pname">{row.name}</span>
                  <b className="sl-ovr">{row.overall}</b>
                </span>
                <span className="sl-nat">
                  <span className="sl-flag">{row.flag}</span>
                  {row.teamCode} <b>{row.year}</b>
                </span>
              </li>
            ))}
          </ol>

          <p className="share-foot">Random World Cup XI · 1950-2026 · build yours</p>

          <div className="share-actions">
            <button className="share-btn primary" type="button" onClick={shareResultCard} disabled={shareStatus === 'building'}>
              <Share2 size={17} />
              {shareStatus === 'building' ? 'Preparing' : shareStatus === 'shared' ? 'Shared' : shareStatus === 'copied' ? 'Copied' : 'Share card'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function overallTier(overall: number): '' | 'elite' | 'gold' {
  if (overall >= 87) return 'gold';
  if (overall >= 80) return 'elite';
  return '';
}

function playGoal(team: 'you' | 'opponent') {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(team === 'you' ? 0.16 : 0.09, now);
    master.connect(ctx.destination);

    if (team === 'you') {
      // quick rising triad — little celebration
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        g.gain.setValueAtTime(0.0001, now + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.5, now + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.22);
        osc.connect(g).connect(master);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.24);
      });
    } else {
      // dull low "ohh" for conceded
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(196, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.6, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 0.47);
    }
    window.setTimeout(() => ctx.close(), 900);
  } catch {
    /* audio not available */
  }
}

function phaseLabel(phase: string): string {
  if (phase.startsWith('Group ')) return `Group match ${phase.slice(6)}`;
  return phase; // Round of 16, Quarter-final, Semi-final, Final
}

function phaseShort(phase: string): string {
  if (phase.startsWith('Group ')) return `G${phase.slice(6)}`;
  if (phase === 'Round of 16') return 'R16';
  if (phase === 'Quarter-final') return 'QF';
  if (phase === 'Semi-final') return 'SF';
  if (phase === 'Final') return 'FIN';
  return phase;
}

function MatchEventRow({ event }: { event: MatchEvent }) {
  const side = event.team === 'you' ? 'you' : 'opp';
  const icon =
    event.kind === 'goal'
      ? '⚽'
      : event.kind === 'card'
        ? event.cardType === 'red'
          ? '🟥'
          : '🟨'
        : event.kind === 'sub'
          ? '🔁'
          : event.penaltyFinal
            ? '🏆'
            : event.penaltyScored
              ? '✓'
              : '×';

  return (
    <div className={`ev ev-${side} ev-${event.kind} ${event.penaltyScored === false ? 'ev-missed' : ''}`.trim()}>
      <span className="ev-min">{event.minute}'</span>
      <span className="ev-icon">{icon}</span>
      <div className="ev-body">
        {event.kind === 'goal' && (
          <>
            <strong>{event.player}</strong>
            {event.assist && <small>assist {event.assist}</small>}
            <b className="ev-score">{event.score}</b>
          </>
        )}
        {event.kind === 'card' && (
          <>
            <strong>{event.player}</strong>
            <small>{event.reason}</small>
          </>
        )}
        {event.kind === 'sub' && (
          <>
            <strong className="ev-in">{event.player}</strong>
            <small className="ev-out">for {event.playerOut}</small>
          </>
        )}
        {event.kind === 'penalties' && (
          <>
            <strong>{event.penaltyFinal ? 'Penalty result' : event.player}</strong>
            {!event.penaltyFinal && <small>{event.penaltyScored ? 'scored' : 'missed'}</small>}
            <b className="ev-score">{event.score}</b>
          </>
        )}
      </div>
    </div>
  );
}

function matchDuration(match: MatchResult): number {
  return Math.max(90, ...match.events.map((event) => event.minute + 1));
}

function scoreAt(match: MatchResult, minute: number) {
  return match.events
    .filter((event) => event.kind === 'goal' && event.minute <= minute)
    .reduce(
      (score, event) => ({
        gf: score.gf + (event.team === 'you' ? 1 : 0),
        ga: score.ga + (event.team === 'opponent' ? 1 : 0),
      }),
      { gf: 0, ga: 0 }
    );
}

function penaltyScoreAt(match: MatchResult, minute: number): string | null {
  if (!match.penalties) return null;
  const kick = [...match.penalties.kicks].reverse().find((item) => item.minute <= minute);
  return kick?.score ?? null;
}

function groupStandingsAt(
  result: SimulationResult,
  liveMinute: number,
  starts: number[],
  durations: number[],
  finished: boolean
): GroupStanding[] {
  const groupEnd = starts[2] + durations[2];
  if (finished || liveMinute >= groupEnd) return result.groupTable;

  const rows = [
    { id: 'YOU', label: 'Tu', pts: 0, gf: 0, ga: 0, gd: 0, you: true },
    ...result.matches.slice(0, 3).map((match) => ({
      id: match.opponent.roster.id,
      label: `${match.opponent.roster.teamName} ${match.opponent.roster.year}`,
      pts: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      you: false,
    })),
  ];
  const byId = new Map(rows.map((row) => [row.id, row]));

  result.matches.slice(0, 3).forEach((match, index) => {
    const elapsed = elapsedForMatch(index, liveMinute, starts[index], durations[index], finished);
    if (elapsed <= 0) return;

    const score = scoreAt(match, elapsed);
    const you = byId.get('YOU');
    const them = byId.get(match.opponent.roster.id);
    if (!you || !them) return;

    you.gf += score.gf;
    you.ga += score.ga;
    them.gf += score.ga;
    them.ga += score.gf;

    if (elapsed >= durations[index]) {
      if (score.gf > score.ga) you.pts += 3;
      else if (score.gf < score.ga) them.pts += 3;
      else {
        you.pts += 1;
        them.pts += 1;
      }
    }
  });

  for (const row of rows) row.gd = row.gf - row.ga;
  return rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (a.you ? -1 : b.you ? 1 : a.label.localeCompare(b.label)));
}

function scoreLabel(match: MatchResult, elapsed: number): string {
  if (elapsed <= 0) return '0-0';
  const penaltyScore = penaltyScoreAt(match, elapsed);
  if (penaltyScore) return `${match.gf}-${match.ga} rig. ${penaltyScore}`;
  if (elapsed >= matchDuration(match)) {
    return `${match.gf}-${match.ga}${match.penalties ? ` rig. ${match.penalties.score}` : ''}`;
  }
  const score = scoreAt(match, elapsed);
  return `${score.gf}-${score.ga}`;
}

function shareLineup(draft: DraftState) {
  return draft.picks
    .map((pick) => {
      const slot = slotById(draft.formation, pick.slotId);
      const position = slot ? slot.position : 'CM';
      return {
        id: pick.player.id,
        order: positionOrder[position],
        position: positionLabels[position],
        number: pick.player.shirtNumber,
        legend: pick.player.legend,
        flag: flagFor(pick.sourceRoster.teamCode),
        name: pick.player.displayName,
        teamCode: pick.sourceRoster.teamCode,
        year: pick.sourceRoster.year,
        overall: pick.player.overall,
      };
    })
    .sort((a, b) => a.order - b.order);
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function buildShareText(result: SimulationResult, draft: DraftState): string {
  const title = result.champion ? 'World Champions' : `Out: ${result.eliminatedPhase}`;
  const players = shareLineup(draft)
    .map((row) => `${row.position} ${row.name} (${row.teamCode} ${row.year}, ${row.overall})`)
    .join('\n');

  return [
    `Glory Draw - ${title}`,
    `Record: ${result.record}`,
    `OVR ${result.ratings.overall} | ATT ${result.ratings.attack} | DEF ${result.ratings.defense}`,
    `Goals: ${result.gf}-${result.ga}`,
    '',
    players,
  ].join('\n');
}

async function createShareCardFile(result: SimulationResult, draft: DraftState): Promise<File> {
  if ('fonts' in document) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  drawShareCanvas(ctx, result, draft);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Card render failed'))), 'image/png', 0.94);
  });

  return new File([blob], 'glory-draw-card.png', { type: 'image/png' });
}

function drawShareCanvas(ctx: CanvasRenderingContext2D, result: SimulationResult, draft: DraftState) {
  const title = result.champion ? 'World Champions' : `Out: ${result.eliminatedPhase}`;
  const rows = shareLineup(draft).slice(0, 11);
  const ink = '#211b16';
  const paper = '#ece5d5';
  const card = '#fbf8f0';
  const red = '#e23120';
  const blue = '#1f5fd0';
  const gold = '#c79a1b';
  const soft = '#7b7060';
  const line = 'rgba(33,27,22,0.18)';
  const accent = result.champion ? gold : red;

  ctx.clearRect(0, 0, 1080, 1350);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = ink;
  for (let x = 0; x < 1080; x += 12) {
    for (let y = 0; y < 1350; y += 12) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();

  drawRoundRect(ctx, 54, 54, 972, 1242, 20, card, ink, 3);
  ctx.fillStyle = accent;
  ctx.fillRect(54, 54, 16, 1242);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  ctx.font = '900 42px "Big Shoulders Display", "Arial Narrow", sans-serif';
  ctx.fillText('GLORY', 96, 122);
  ctx.fillStyle = red;
  ctx.fillText('DRAW', 238, 122);
  ctx.fillStyle = soft;
  ctx.font = '700 22px "Space Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${draft.formation} XI - 1950-2026`, 984, 118);
  ctx.textAlign = 'left';

  ctx.fillStyle = ink;
  ctx.font = '900 82px "Big Shoulders Display", "Arial Narrow", sans-serif';
  drawFittedText(ctx, title.toUpperCase(), 96, 220, 610);
  ctx.fillStyle = soft;
  ctx.font = '700 20px "Space Mono", monospace';
  ctx.fillText('FINAL CARD', 98, 264);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = '900 112px "Big Shoulders Display", "Arial Narrow", sans-serif';
  ctx.fillText(result.record, 984, 246);
  ctx.fillStyle = soft;
  ctx.font = '700 20px "Space Mono", monospace';
  ctx.fillText('W-D-L', 984, 282);
  ctx.textAlign = 'left';

  const statY = 320;
  drawMetric(ctx, 96, statY, 'OVERALL', result.ratings.overall, ink, line);
  drawMetric(ctx, 318, statY, 'GOALS', result.gf, ink, line);
  drawMetric(ctx, 540, statY, 'AGAINST', result.ga, ink, line);
  drawMetric(ctx, 762, statY, 'WINS', result.wins, gold, line);

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 448);
  ctx.lineTo(984, 448);
  ctx.stroke();

  ctx.fillStyle = soft;
  ctx.font = '700 18px "Space Mono", monospace';
  ctx.fillText('NO.', 96, 488);
  ctx.fillText('ROLE', 152, 488);
  ctx.fillText('PLAYER', 232, 488);
  ctx.textAlign = 'right';
  ctx.fillText('NATION', 984, 488);
  ctx.textAlign = 'left';

  rows.forEach((row, index) => {
    const y = 532 + index * 61;
    const tier = overallTier(row.overall);
    const tierColor = tier === 'gold' ? gold : tier === 'elite' ? blue : ink;

    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(96, y + 22);
    ctx.lineTo(984, y + 22);
    ctx.stroke();

    ctx.fillStyle = soft;
    ctx.font = '700 24px "Space Mono", monospace';
    ctx.fillText(String(row.number || '-'), 96, y);

    ctx.fillStyle = red;
    ctx.font = '900 27px "Big Shoulders Display", "Arial Narrow", sans-serif';
    ctx.fillText(row.position, 154, y);

    ctx.fillStyle = tierColor;
    ctx.font = '900 35px "Big Shoulders Display", "Arial Narrow", sans-serif';
    const name = fittedCanvasText(ctx, row.name.toUpperCase(), 430);
    ctx.fillText(name, 232, y);
    const nameWidth = ctx.measureText(name).width;
    ctx.font = '900 31px "Big Shoulders Display", "Arial Narrow", sans-serif';
    ctx.fillText(String(row.overall), Math.min(690, 232 + nameWidth + 14), y);

    ctx.textAlign = 'right';
    ctx.fillStyle = soft;
    ctx.font = '700 24px "Space Mono", monospace';
    ctx.fillText(`${row.flag} ${row.teamCode} ${row.year}`, 984, y);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = soft;
  ctx.font = '700 22px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Random World Cup XI - build yours on Glory Draw', 540, 1246);
  ctx.textAlign = 'left';
}

function drawMetric(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  valueColor: string,
  line: string
) {
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 188, 78);
  ctx.fillStyle = valueColor;
  ctx.font = '900 44px "Big Shoulders Display", "Arial Narrow", sans-serif';
  ctx.fillText(String(value), x + 18, y + 48);
  ctx.fillStyle = '#7b7060';
  ctx.font = '700 16px "Space Mono", monospace';
  ctx.fillText(label, x + 18, y + 68);
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke: string,
  lineWidth: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawFittedText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number) {
  ctx.fillText(fittedCanvasText(ctx, value, maxWidth), x, y);
}

function fittedCanvasText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 4 && ctx.measureText(`${text}...`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trim()}...`;
}

function elapsedForMatch(index: number, liveMinute: number, start: number, duration: number, finished: boolean): number {
  if (finished) return duration;
  if (liveMinute >= start + duration) return duration;
  if (liveMinute <= start && index > 0) return 0;
  return Math.max(0, Math.min(duration, liveMinute - start));
}
