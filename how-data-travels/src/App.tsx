import { useEffect, useState } from 'react';
import { Welcome } from './components/Welcome';
import { Mission } from './components/Mission';
import { audio } from './audio/audio';
import { loadProgress, saveResult, type Progress } from './progress/progress';
import { MISSION } from './content/lesson';
import { starsFor } from './challenges/reassemble';

type Screen = 'welcome' | 'mission' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [last, setLast] = useState<{ score: number; stars: number } | null>(null);
  useEffect(() => () => audio.dispose(), []);

  const finish = (score: number) => {
    const r = { score, stars: starsFor(score) };
    setLast(r); setProgress(saveResult(MISSION.id, r)); setScreen('results');
  };

  if (screen === 'mission') return <Mission key="m" onFinish={finish} onExit={() => setScreen('welcome')} />;
  if (screen === 'results' && last) {
    return (
      <main className="welcome"><div className="hero">
        <h1>Mission complete! 🎉</h1>
        <p className="stars">{'⭐'.repeat(last.stars)}{'☆'.repeat(3 - last.stars)}</p>
        <p>Score: <b>{last.score}</b> · Stages covered: 3 Packetization, 4 Routing, 5 Transmission, 6 Reassembly</p>
        <p>{last.stars < 3 ? 'Review: sequence numbers in packet headers tell the receiver how to restore the original order.' : 'No concepts to review. Great work!'}</p>
        <div className="row"><button className="btn" onClick={() => setScreen('mission')}>Replay mission</button><button className="btn ghost" onClick={() => setScreen('welcome')}>Home</button></div>
      </div></main>
    );
  }
  return <Welcome onStart={() => setScreen('mission')} best={progress.completed[MISSION.id]} />;
}
