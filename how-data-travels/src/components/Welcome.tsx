import { audio } from '../audio/audio';
import { AudioBar } from './AudioBar';

export function Welcome({ onStart, best }: { onStart: () => void; best?: { score: number; stars: number } }) {
  return (
    <main className="welcome">
      <AudioBar />
      <div className="hero">
        <div className="orbs" aria-hidden="true"><span style={{ background: '#ff9f43' }}>1</span><span style={{ background: '#a855f7' }}>2</span><span style={{ background: '#22c55e' }}>3</span><span style={{ background: '#0ea5e9' }}>4</span></div>
        <h1>How Data Travels</h1>
        <p>Follow a message from one computer to another. Watch it become packets, cross a network, and come back together.</p>
        <button className="btn big" onClick={() => { audio.play('send'); onStart(); }}>Start Learning ▶</button>
        {best && <p className="best">Best result: {'⭐'.repeat(best.stars)} · {best.score} points</p>}
      </div>
    </main>
  );
}
