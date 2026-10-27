export interface LessonStep { id: string; stage: number; title: string; emoji: string; text: string }

export const LESSON: LessonStep[] = [
  { id: 'packetize', stage: 3, emoji: '📦', title: 'Split into packets',
    text: 'Before travelling, data is cut into small pieces called packets. Each packet carries a piece of the message plus a small header (like a label) with the destination and a sequence number. Splitting into packets is different from encoding data as bits.' },
  { id: 'route', stage: 4, emoji: '🧭', title: 'Routers choose a path',
    text: 'A router looks at each packet\'s header and forwards it toward its destination. Packets from the same message may take different routes. Turn on "Different routes" to see this in the simulation.' },
  { id: 'medium', stage: 5, emoji: '💡', title: 'Medium vs. route',
    text: 'The route is the logical path packets follow through the network. The medium is the physical way signals move on each hop: fiber light, copper electricity, or Wi-Fi radio. One route can cross several different media.' },
  { id: 'reassemble', stage: 6, emoji: '🧩', title: 'Reassemble at the receiver',
    text: 'Packets can arrive out of order. Watch the arrival order below. The receiver uses sequence numbers to put them back in order and rebuild the original message.' }
];

export const MISSION = { id: 'mission-1', title: 'Mission 1: Send a message across the network' };
