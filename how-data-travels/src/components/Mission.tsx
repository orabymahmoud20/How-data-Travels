import { Suspense, lazy, useCallback, useState } from 'react';
import { LESSON, MISSION } from '../content/lesson';
import { PACKETS } from '../scene/packets';
import { audio } from '../audio/audio';
import { AudioBar } from './AudioBar';
import { Fallback, SceneBoundary, hasWebGL } from './WebGLGuard';
import { ReassembleChallenge } from './ReassembleChallenge';

const NetworkScene = lazy(() => import('../scene/NetworkScene'));

export function Mission({ onFinish, onExit }: { onFinish: (points: number) => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<'lesson' | 'challenge'>('lesson');
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [follow, setFollow] = useState(false);
  const [alt, setAlt] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [arrived, setArrived] = useState<number[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const onArrive = useCallback((o: number[]) => setArrived(o), []);
  const lesson = LESSON[step];
  const webgl = hasWebGL();
  const go = (fn: () => void) => () => { audio.play('click'); fn(); };

  return (
    <main className="mission">
      <header className="top">
        <button className="btn ghost" onClick={go(onExit)}>← Home</button>
        <h2>{MISSION.title}</h2>
        <AudioBar narrationText={lesson.text} />
      </header>
      <section className="viewport">
        {webgl ? (
          <SceneBoundary>
            <Suspense fallback={<div className="loading"><div className="spinner" />Loading 3D scene…</div>}>
              <NetworkScene playing={playing} speed={slow ? 0.35 : 1} replayKey={replayKey} follow={follow} altRoutes={alt} onArrive={onArrive} />
            </Suspense>
          </SceneBoundary>
        ) : <Fallback reason="WebGL is not available in this browser or device." />}
        <div className="hud" aria-live="polite">
          Arrival order: {arrived.length ? arrived.map((id) => <b key={id} className="chip" style={{ background: PACKETS.find((p) => p.id === id)?.color }}>{id}</b>) : '—'}
          {arrived.length === PACKETS.length && (arrived.some((id, i) => id !== i + 1) ? ' (out of order!)' : ' (in order)')}
        </div>
        <div className="controls">
          <button className="btn" onClick={go(() => setPlaying(!playing))}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button className="btn" onClick={() => { audio.play('send'); setReplayKey((k) => k + 1); setPlaying(true); }}>↺ Replay</button>
          <button className={'btn toggle' + (slow ? ' on' : '')} aria-pressed={slow} onClick={go(() => setSlow(!slow))}>🐢 Slow</button>
          <button className={'btn toggle' + (follow ? ' on' : '')} aria-pressed={follow} onClick={go(() => setFollow(!follow))}>🎥 Follow packet 1</button>
          <button className={'btn toggle' + (alt ? ' on' : '')} aria-pressed={alt} onClick={go(() => setAlt(!alt))}>🔀 Different routes</button>
        </div>
      </section>
      <section className="panel">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'lesson'} className={tab === 'lesson' ? 'on' : ''} onClick={go(() => setTab('lesson'))}>Lesson</button>
          <button role="tab" aria-selected={tab === 'challenge'} className={tab === 'challenge' ? 'on' : ''} onClick={go(() => setTab('challenge'))}>Challenge</button>
        </div>
        {tab === 'lesson' ? (
          <div className="lesson">
            <div className="dots">{LESSON.map((l, i) => <button key={l.id} aria-label={`Step ${i + 1}: ${l.title}`} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={go(() => setStep(i))} />)}</div>
            <h3>{lesson.emoji} Stage {lesson.stage}: {lesson.title}</h3>
            <p>{lesson.text}</p>
            <div className="row">
              <button className="btn ghost" disabled={step === 0} onClick={go(() => setStep(step - 1))}>Back</button>
              {step < LESSON.length - 1
                ? <button className="btn" onClick={go(() => setStep(step + 1))}>Next stage →</button>
                : <button className="btn" onClick={go(() => setTab('challenge'))}>Try the challenge →</button>}
            </div>
          </div>
        ) : (
          <>
            <ReassembleChallenge onComplete={setPoints} />
            {points !== null && <button className="btn big" onClick={() => { audio.play('done'); onFinish(points); }}>Finish mission ✔</button>}
          </>
        )}
      </section>
    </main>
  );
}
