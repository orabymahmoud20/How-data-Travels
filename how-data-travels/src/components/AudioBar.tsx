import { useState } from 'react';
import { audio } from '../audio/audio';

export function AudioBar({ narrationText }: { narrationText?: string }) {
  const [muted, setMuted] = useState(audio.isMuted());
  const [vol, setVol] = useState(audio.getVolume());
  const [music, setMusic] = useState(false);
  return (
    <div className="audiobar" role="group" aria-label="Audio controls">
      <button className="icon" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { audio.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      <input type="range" min={0} max={1} step={0.05} value={vol} aria-label="Volume" onChange={(e) => { const v = +e.target.value; audio.setVolume(v); setVol(v); }} />
      <button className={'icon' + (music ? ' on' : '')} aria-pressed={music} aria-label="Background music" onClick={() => { audio.toggleMusic(!music); setMusic(!music); }}>🎵</button>
      {narrationText && <button className="icon" aria-label="Read lesson aloud" onClick={() => audio.narrate(narrationText)}>🗣️</button>}
    </div>
  );
}
