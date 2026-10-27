import { useMemo, useState } from 'react';
import { MESSAGE, checkOrder, scoreFor, seededShuffle, split, type Pkt } from '../challenges/reassemble';
import { audio } from '../audio/audio';

const COLORS = ['#ff9f43', '#a855f7', '#22c55e', '#0ea5e9'];
const show = (s: string) => s.replace(/ /g, '␣');

function Card({ p, onClick, label }: { p: Pkt; onClick: () => void; label: string }) {
  return (
    <button className="pkt" style={{ borderColor: COLORS[(p.seq - 1) % 4] }} onClick={onClick} aria-label={label}>
      <span className="hdr" style={{ background: COLORS[(p.seq - 1) % 4] }}>#{p.seq} → Receiver</span>
      <span className="body">{show(p.payload)}</span>
    </button>
  );
}

export function ReassembleChallenge({ onComplete }: { onComplete: (points: number) => void }) {
  const original = useMemo(() => split(MESSAGE), []);
  const [tray, setTray] = useState<Pkt[]>(() => seededShuffle(original));
  const [slots, setSlots] = useState<Pkt[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  const place = (p: Pkt) => { audio.play('click'); setTray(tray.filter((x) => x !== p)); setSlots([...slots, p]); setFeedback(null); };
  const unplace = (p: Pkt) => { if (points !== null) return; audio.play('click'); setSlots(slots.filter((x) => x !== p)); setTray([...tray, p]); };

  const check = () => {
    const n = attempts + 1;
    setAttempts(n);
    const r = checkOrder(slots, original);
    if (r.correct) {
      const pts = scoreFor(n);
      setPoints(pts); audio.play('ok'); onComplete(pts);
      setFeedback({ ok: true, text: `Correct! Sequence numbers let the receiver rebuild "${MESSAGE}" even when packets arrive out of order. +${pts} points.` });
    } else {
      audio.play('bad');
      setFeedback({ ok: false, text: `Not yet. Position${r.wrongPositions.length > 1 ? 's' : ''} ${r.wrongPositions.join(', ')} ${r.wrongPositions.length > 1 ? 'are' : 'is'} out of order. Check the sequence numbers (#1, #2, ...) in each packet header and read the pieces in that order.` });
    }
  };
  const retry = () => { setTray(seededShuffle(original, 7 + attempts + 1)); setSlots([]); setFeedback(null); };

  return (
    <div className="challenge">
      <h3>🧩 Reassemble the packets</h3>
      <p>The packets arrived shuffled. Tap them in the correct order to rebuild the message.</p>
      <div className="row tray" aria-label="Arrived packets">{tray.map((p) => <Card key={p.seq} p={p} label={`Packet ${p.seq}`} onClick={() => place(p)} />)}{tray.length === 0 && <em>All packets placed</em>}</div>
      <div className="row slots" aria-label="Your order">
        {original.map((_, i) => slots[i] ? <Card key={slots[i].seq} p={slots[i]} label={`Remove packet ${slots[i].seq}`} onClick={() => unplace(slots[i])} /> : <div key={i} className="slot">{i + 1}</div>)}
      </div>
      <div className="preview">Message: <b>{slots.map((s) => s.payload).join('') || '…'}</b></div>
      {feedback && <div className={'feedback ' + (feedback.ok ? 'ok' : 'bad')} role="status">{feedback.text}</div>}
      <div className="row">
        {points === null && <button className="btn" disabled={slots.length !== original.length} onClick={check}>Check answer</button>}
        {points === null && feedback && !feedback.ok && <button className="btn ghost" onClick={retry}>Try again</button>}
      </div>
    </div>
  );
}
