# How Data Travels

Interactive 3D educational game about how digital information travels from a sender to a receiver.
Stack: React 18, Vite, TypeScript, Three.js via React Three Fiber and drei, Howler.js. No backend, no API keys.

## Status (milestone 1)
Implemented: welcome screen, one 3D mission (sender, router, three nodes, receiver, animated numbered packets,
Play/Pause/Replay/Slow, follow-packet camera, different-routes toggle), a 4-step lesson (stages 3 to 6),
the "Reassemble the packets" challenge with validation, scoring, feedback and retry, results screen with stars,
localStorage progress, audio controls, and a WebGL fallback.
Not yet built: stages 1 and 2 (creation, binary encoding), the full six-stage flow, and the other five challenge types.

## Install, develop, build, test
    npm install
    npm run dev       # http://localhost:5173
    npm run build     # type-check + production build into dist/
    npm test          # unit tests for challenge logic

## Code layout
- `src/content/` lesson text
- `src/challenges/` pure challenge logic and tests
- `src/scene/` 3D scene and packet definitions (lazy-loaded)
- `src/audio/` Howler manager
- `src/progress/` localStorage progress
- `src/components/` UI

## Audio and assets
Sound effects and background music are generated at runtime as tiny WAV tones, so no files are required.
To use real audio, put files in `public/audio/` (e.g. `click.mp3`, `music.mp3`) and change the `src` in
`src/audio/audio.ts` to `['/audio/click.mp3']`. Use original or properly licensed audio only.
Nothing plays before a user click. Narration uses the browser's speech synthesis (button in the audio bar);
the lesson text is always visible as the caption.

## Accuracy notes
The simulation is a simplified model: packets may take different routes, and the route (logical path) is
distinct from the medium (fiber, copper, wireless). It is not a full protocol-stack simulation.
