export interface PacketDef { id: number; color: string; via: 'n1' | 'n2'; speed: number; delay: number }
export const PACKETS: PacketDef[] = [
  { id: 1, color: '#ff9f43', via: 'n1', speed: 1, delay: 0 },
  { id: 2, color: '#a855f7', via: 'n2', speed: 0.8, delay: 0.7 },
  { id: 3, color: '#22c55e', via: 'n1', speed: 1, delay: 1.4 },
  { id: 4, color: '#0ea5e9', via: 'n2', speed: 1.1, delay: 2.1 }
];
