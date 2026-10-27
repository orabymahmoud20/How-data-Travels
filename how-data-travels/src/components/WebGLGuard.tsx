import { Component, type ReactNode } from 'react';

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function Fallback({ reason }: { reason: string }) {
  return (
    <div className="fallback">
      <h3>3D view unavailable</h3>
      <p>{reason}</p>
      <p>Text version: a message on the <b>Sender</b> is split into numbered packets, a <b>Router</b> forwards them through network nodes (possibly on different routes), and the <b>Receiver</b> uses sequence numbers to rebuild the message. The lesson and challenge still work below.</p>
    </div>
  );
}

export class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() { return this.state.error ? <Fallback reason={`The 3D scene crashed: ${this.state.error}`} /> : this.props.children; }
}
