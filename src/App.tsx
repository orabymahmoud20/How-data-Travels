import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Volume2,
  VolumeX,
  Compass,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Cpu,
  Network,
  Wifi,
  ShieldCheck,
  BookOpen,
  Layers,
  Send,
  Binary,
  Boxes,
  GitFork,
  Radio,
  FileCheck2,
  Eye,
  Sparkles,
  HelpCircle,
  Trophy,
  RefreshCw,
  FileText,
  Music,
  Mic
} from 'lucide-react';

// ============================================================================
// 1. TYPES & DATA STRUCTURES
// ============================================================================

type ScreenMode = 'welcome' | 'intro' | 'stage' | 'final' | 'docs';
type TransmissionMedium = 'fiber' | 'copper' | 'wireless';
type RouteChoice = 'auto' | 'north' | 'south';

interface StageConfig {
  id: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  badgeColor: string;
  iconName: string;
  conceptSummary: string;
  detailedPoints: string[];
  accuracyNote: string;
  narrationText: string;
  cameraTarget: [number, number, number];
  cameraPosition: [number, number, number];
  challenge: {
    title: string;
    instruction: string;
    points: number;
  };
}

interface UserProgress {
  completedStages: number[];
  stageScores: Record<number, number>;
  selectedMessageType: 'text' | 'image' | 'file';
  customMessage: string;
  preferredMedium: TransmissionMedium;
  preferredRoute: RouteChoice;
}

// ============================================================================
// 2. PROCEDURAL AUDIO & NARRATION MANAGER (Howler-compatible API + WebAudio)
// ============================================================================
// Uses procedural Web Audio API sound synthesis so all sound effects, packet
// hums, and ambient background melodies work 100% out-of-the-box without external
// MP3 404 errors, while providing a Howler-compatible interface and SpeechSynthesis narration.

class SoundController {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public volume: number = 0.7;
  public bgmPlaying: boolean = false;
  private bgmInterval: number | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.065);
  }

  public playPacketPulse(pitchOffset = 0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 360 + pitchOffset * 60;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12 * this.volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  public playSuccess() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const startTime = this.ctx.currentTime + idx * 0.08;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  public playError() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [310, 250];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const startTime = this.ctx.currentTime + idx * 0.12;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  }

  public toggleBGM(enable?: boolean): boolean {
    const nextState = enable !== undefined ? enable : !this.bgmPlaying;
    this.bgmPlaying = nextState;

    if (this.bgmInterval) {
      window.clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }

    if (this.bgmPlaying && !this.isMuted) {
      this.initContext();
      const chordNotes = [261.63, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63, 293.66];
      let step = 0;
      this.bgmInterval = window.setInterval(() => {
        if (this.isMuted || !this.bgmPlaying || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const freq = chordNotes[step % chordNotes.length];
        step++;

        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.04 * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + 1.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.15);
      }, 1200);
    }

    return this.bgmPlaying;
  }

  public speakNarration(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    if (this.isMuted) {
      if (onEnd) onEnd();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = this.volume;
    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }
    window.speechSynthesis.speak(utterance);
  }

  public stopNarration() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public cleanup() {
    if (this.bgmInterval) {
      window.clearInterval(this.bgmInterval);
    }
    this.stopNarration();
  }
}

const soundFX = new SoundController();

// ============================================================================
// 3. LESSON STAGES CONFIGURATION
// ============================================================================

const STAGES: StageConfig[] = [
  {
    id: 1,
    title: 'Stage 1: Creating Digital Content',
    shortTitle: '1. Create',
    subtitle: 'Everything starts as an idea on the sender’s device',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    iconName: 'Send',
    conceptSummary:
      'When you type a text message, snap a photo, or attach a document on your computer or phone, the application prepares that content to be sent across the network.',
    detailedPoints: [
      'Applications (like chat apps, browsers, or email clients) capture user input such as text characters, pixels, or audio samples.',
      'Before anything leaves your computer, the operating system knows WHO is sending it (Source IP) and WHERE it needs to go (Destination IP).',
      'Different types of content (short messages vs. high-res images) vary in size, affecting how many packets will be needed later.'
    ],
    accuracyNote:
      'Creating a file or message happens at the Application Layer. At this moment, the data is still human-friendly on your screen.',
    narrationText:
      'Welcome to Stage 1! Every journey across the Internet begins when you create content on your device—like typing Hello World. Before it can travel across miles of cables and routers, your device prepares it for the journey.',
    cameraTarget: [-8.5, 0.8, 0],
    cameraPosition: [-8.5, 4.2, 6.8],
    challenge: {
      title: 'Challenge 1: What Happens Next?',
      instruction:
        'You just typed "HELLO!" on your laptop and clicked Send. Identify the immediate next step your device must perform so network hardware can process the message.',
      points: 100
    }
  },
  {
    id: 2,
    title: 'Stage 2: Digital Encoding (Bits & Bytes)',
    shortTitle: '2. Encode',
    subtitle: 'Translating characters and media into binary 0s and 1s',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    iconName: 'Binary',
    conceptSummary:
      'Computers store and process information using binary digits—bits (0 and 1) grouped into 8-bit bytes. Encoding schemes like UTF-8 or ASCII map every character to a specific binary number.',
    detailedPoints: [
      'A "bit" is the smallest unit of digital data: either a 0 or a 1.',
      '8 bits form 1 "byte", which can represent 256 different values (for example, uppercase "H" is 01001000 in ASCII/UTF-8).',
      'Encoding is NOT the same as splitting data into network packets—encoding represents the data itself in binary format.'
    ],
    accuracyNote:
      'Visual Note: The floating 0s and 1s in our 3D scene are a conceptual visualization! Inside real hardware, bits are stored as tiny electrical charges or memory states, not literal floating numbers.',
    narrationText:
      'Stage 2: Digital Encoding. Computers do not send cardboard letters through pipes. Instead, characters, colors, and sounds are encoded into binary bits—zeros and ones. Eight bits make one byte! Remember, our 3D binary stream is a helpful visualization of internal memory states.',
    cameraTarget: [-6.5, 1.0, 0],
    cameraPosition: [-6.5, 3.8, 6.2],
    challenge: {
      title: 'Challenge 2: Order the Data Pipeline',
      instruction:
        'Arrange the 4 steps of preparing and sending digital information in their accurate chronological sequence from start to finish.',
      points: 100
    }
  },
  {
    id: 3,
    title: 'Stage 3: Packetization',
    shortTitle: '3. Packetize',
    subtitle: 'Splitting binary data into labeled envelopes called Packets',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    iconName: 'Boxes',
    conceptSummary:
      'Sending a massive file all at once would clog network lines. Instead, networking protocols chop the binary data into small chunks called packets and attach a Header to each one.',
    detailedPoints: [
      'Payload: The actual piece of your message or file carried inside the packet.',
      'Header: Crucial metadata attached to the front of each packet—including Source IP, Destination IP, and Packet Sequence Number (e.g., Packet 1 of 3, 2 of 3, 3 of 3).',
      'Because each packet has its own label, multiple users can share the same network cables fairly.'
    ],
    accuracyNote:
      'Important Distinction: Binary encoding turns human content into bits; Packetization slices those bits into manageable chunks and adds addressing headers.',
    narrationText:
      'Stage 3: Packetization. Instead of sending a giant block of data all at once, your computer slices the encoded data into smaller pieces called packets. Each packet gets a Header containing the sender address, destination address, and packet number—like numbering pages in a letter!',
    cameraTarget: [-4.2, 1.0, 0],
    cameraPosition: [-4.2, 4.5, 6.8],
    challenge: {
      title: 'Challenge 3: Inspect the Packet Header',
      instruction:
        'Click to assemble a valid network packet for chunk #2 of our message so routers know where to deliver it and the receiver knows how to put it back together.',
      points: 100
    }
  },
  {
    id: 4,
    title: 'Stage 4: Routing Across Nodes',
    shortTitle: '4. Route',
    subtitle: 'Routers direct packets through interconnected network hops',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    iconName: 'GitFork',
    conceptSummary:
      'Once packets leave your local router, they travel through a mesh of intermediate network nodes (routers). Each router inspects the packet’s destination address and forwards it along the best available path.',
    detailedPoints: [
      'Routers act like intelligent traffic controllers at network intersections.',
      'Packets from the SAME message do NOT have to take the exact same route! If Path A is congested, Packet #2 can take Path B while Packet #1 and #3 take Path A.',
      'If one network node goes offline, routers dynamically redirect packets around the outage.'
    ],
    accuracyNote:
      'Watch the 3D scene! Notice how our colored packets split across both the Northern Relay (Node A) and Southern Relay (Node B) to reach the receiver.',
    narrationText:
      'Stage 4: Routing! Your home router forwards packets into a web of network nodes. Routers read each packet header and pick the fastest path available at that split second. Packets from the same message can even travel along completely different routes!',
    cameraTarget: [0, 0.8, 0],
    cameraPosition: [0, 7.5, 9.5],
    challenge: {
      title: 'Challenge 4: Interactive Packet Router',
      instruction:
        'Alert! Relay Node A (North Path) is experiencing heavy congestion (98% load). Choose the optimal routing strategy for your router so packets reach the destination without timing out.',
      points: 100
    }
  },
  {
    id: 5,
    title: 'Stage 5: Physical Transmission Media',
    shortTitle: '5. Transmit',
    subtitle: 'How signals physically move through Fiber, Copper, and Wi-Fi',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    iconName: 'Radio',
    conceptSummary:
      'Logical routes describe WHICH nodes a packet visits, while the Transmission Medium is the physical material carrying the signal between two nodes.',
    detailedPoints: [
      'Fiber-Optic Cable: Sends pulses of light through glass fibers at tremendous speeds across cities and oceans.',
      'Copper Ethernet Cable: Sends electrical voltage signals through twisted metal wires—common in offices and home LANs.',
      'Wireless (Wi-Fi / Cellular): Broadcasts radio wave frequencies through the air for mobile devices without physical cords.'
    ],
    accuracyNote:
      'Crucial Distinction: A single packet often travels across ALL THREE media on one trip—starting on Wi-Fi from your laptop, flowing through copper Ethernet in a building, and racing as light through undersea fiber-optic cables!',
    narrationText:
      'Stage 5: Physical Transmission. While routing decides which path to take, the transmission medium is how signals physically move from one device to the next. Try switching between Fiber-Optic light pulses, Copper electrical signals, and Wireless radio waves in the simulator!',
    cameraTarget: [1.5, 0.8, 0],
    cameraPosition: [1.5, 5.2, 8.2],
    challenge: {
      title: 'Challenge 5: Match the Transmission Medium',
      instruction:
        'Match each physical transmission technology (Fiber-Optic, Copper Cable, and Wireless Radio) with how it physically carries data signals.',
      points: 100
    }
  },
  {
    id: 6,
    title: 'Stage 6: Receiving & Reassembly',
    shortTitle: '6. Reassemble',
    subtitle: 'Checking integrity, ordering packets, and displaying the message',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    iconName: 'FileCheck2',
    conceptSummary:
      'Because packets can travel along different routes at different speeds, they often arrive out of order! The receiving device collects them, reads their sequence numbers, and reconstructs the original file.',
    detailedPoints: [
      'Out-of-Order Arrival: Packet #3 might arrive before Packet #2 if it took a faster route.',
      'Reordering & Verification: Transport protocols (like TCP) use the sequence numbers in the packet headers to sort them back into 1 → 2 → 3 order.',
      'Missing Packet Request: If a packet is corrupted or lost along the way, the receiver asks the sender to retransmit just that missing packet.'
    ],
    accuracyNote:
      'Once all packets are sorted and their headers are stripped away, the binary payload is decoded back into the exact message or image on the receiver’s screen!',
    narrationText:
      'Stage 6: Receiving and Reassembly! Because packets took different routes, Packet 3 arrived before Packet 2! Thankfully, the receiving computer reads the sequence numbers in each header, puts them back in order, strips off the headers, and displays your original message.',
    cameraTarget: [8.0, 1.0, 0],
    cameraPosition: [8.0, 4.2, 6.8],
    challenge: {
      title: 'Challenge 6: Reassemble & Diagnose Delivery',
      instruction:
        'Packets arrived out of order at the Receiver! First, arrange the arrived packets into their proper sequence numbers (1, 2, 3) to reconstruct the message, and answer the diagnostic check.',
      points: 100
    }
  }
];

// ============================================================================
// 4. INTERACTIVE 3D NETWORK SIMULATION VIEWPORT (THREE.JS)
// ============================================================================

interface ThreeSimulationProps {
  currentStage: number;
  isPlaying: boolean;
  isSlowMo: boolean;
  followPacket: boolean;
  medium: TransmissionMedium;
  routeChoice: RouteChoice;
  customMessage: string;
  replayTrigger: number;
  onPacketArrive?: () => void;
}

const ThreeNetworkViewport: React.FC<ThreeSimulationProps> = ({
  currentStage,
  isPlaying,
  isSlowMo,
  followPacket,
  medium,
  routeChoice,
  customMessage,
  replayTrigger
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [simPhaseLabel, setSimPhaseLabel] = useState<string>('Ready');
  const [activePacketInfo, setActivePacketInfo] = useState<{
    id: number;
    seq: string;
    chunk: string;
    route: string;
    progress: number;
  } | null>(null);

  // Refs for mutable animation state so we don't recreate the WebGL context on prop updates
  const stateRef = useRef({
    currentStage,
    isPlaying,
    isSlowMo,
    followPacket,
    medium,
    routeChoice,
    customMessage,
    simTime: 0,
    isDragging: false,
    prevMouse: { x: 0, y: 0 },
    cameraAngle: { theta: 0, phi: 0.45, distance: 14 },
    cameraTargetOffset: new THREE.Vector3(0, 0.8, 0)
  });

  useEffect(() => {
    stateRef.current.currentStage = currentStage;
    stateRef.current.isPlaying = isPlaying;
    stateRef.current.isSlowMo = isSlowMo;
    stateRef.current.followPacket = followPacket;
    stateRef.current.medium = medium;
    stateRef.current.routeChoice = routeChoice;
    stateRef.current.customMessage = customMessage;
  }, [currentStage, isPlaying, isSlowMo, followPacket, medium, routeChoice, customMessage]);

  useEffect(() => {
    // Reset timeline when stage or replayTrigger changes
    stateRef.current.simTime = 0;
    stateRef.current.cameraAngle.theta = 0;
  }, [currentStage, replayTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch (e) {
      setWebglError('WebGL is unavailable on this browser or device. Using interactive 2D diagram fallback.');
      return;
    }

    // Scene setup with bright friendly sky-blue atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef7ff');
    scene.fog = new THREE.FogExp2('#eef7ff', 0.018);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 8, 15);

    // Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#fffbeb', 1.1);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 14;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight('#bae6fd', 0.5);
    fillLight.position.set(-10, 6, -8);
    scene.add(fillLight);

    // Ground platform (soft stylized floating island / studio floor)
    const floorGeo = new THREE.BoxGeometry(24, 0.5, 11);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.25, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle grid on top of the white platform
    const gridHelper = new THREE.GridHelper(23.8, 24, '#bae6fd', '#e0f2fe');
    gridHelper.position.set(0, 0.01, 0);
    scene.add(gridHelper);

    // Base border trim
    const trimGeo = new THREE.BoxGeometry(24.3, 0.35, 11.3);
    const trimMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.4 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, -0.35, 0);
    scene.add(trim);

    // Helper to build a stylized low-poly computer workstation
    const createComputerGroup = (primaryColor: string, screenColor: string, isSender: boolean) => {
      const group = new THREE.Group();

      // Desk / pedestal
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 0.25, 24),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4 })
      );
      base.position.y = 0.125;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Monitor stand
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.8, 0.28),
        new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4 })
      );
      stand.position.y = 0.55;
      stand.castShadow = true;
      group.add(stand);

      // Monitor casing
      const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 1.2, 0.22),
        new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.3 })
      );
      monitor.position.y = 1.25;
      monitor.castShadow = true;
      group.add(monitor);

      // Glowing screen
      const screenMat = new THREE.MeshBasicMaterial({ color: screenColor });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.98), screenMat);
      screen.position.set(0, 1.25, 0.115);
      group.add(screen);

      // Keyboard in front
      const keyboard = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.08, 0.42),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.5 })
      );
      keyboard.position.set(0, 0.28, 0.65);
      keyboard.castShadow = true;
      group.add(keyboard);

      // Rotate slightly toward the center of the network
      group.rotation.y = isSender ? 0.35 : -0.35;
      return { group, screenMat };
    };

    // Helper to build a stylized router with antennas and blinking LEDs
    const createRouterGroup = (color: string, antennaCount = 2) => {
      const group = new THREE.Group();

      // Pedestal
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.18, 20),
        new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.5 })
      );
      pad.position.y = 0.09;
      pad.receiveShadow = true;
      group.add(pad);

      // Router body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.72, 0.42, 16),
        new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 })
      );
      body.position.y = 0.38;
      body.castShadow = true;
      group.add(body);

      // Glowing status ring
      const ringMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.04, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.48;
      group.add(ring);

      // Antennas
      for (let i = 0; i < antennaCount; i++) {
        const angle = (i / antennaCount) * Math.PI - Math.PI / 4;
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 0.85, 8),
          new THREE.MeshStandardMaterial({ color: '#334155' })
        );
        ant.position.set(Math.cos(angle) * 0.48, 0.85, Math.sin(angle) * 0.48);
        ant.castShadow = true;
        group.add(ant);

        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 10, 10),
          new THREE.MeshBasicMaterial({ color: '#22d3ee' })
        );
        tip.position.set(Math.cos(angle) * 0.48, 1.3, Math.sin(angle) * 0.48);
        group.add(tip);
      }

      return { group, ringMat };
    };

    // Node coordinates
    const POS = {
      sender: new THREE.Vector3(-8.8, 0, 0),
      homeRouter: new THREE.Vector3(-4.6, 0, 0),
      nodeNorth: new THREE.Vector3(0, 0, -2.8),
      nodeSouth: new THREE.Vector3(0, 0, 2.8),
      destRouter: new THREE.Vector3(4.6, 0, 0),
      receiver: new THREE.Vector3(8.8, 0, 0)
    };

    // Instantiate Devices
    const senderObj = createComputerGroup('#0284c7', '#38bdf8', true);
    senderObj.group.position.copy(POS.sender);
    scene.add(senderObj.group);

    const receiverObj = createComputerGroup('#059669', '#34d399', false);
    receiverObj.group.position.copy(POS.receiver);
    scene.add(receiverObj.group);

    const homeRouterObj = createRouterGroup('#6366f1', 2);
    homeRouterObj.group.position.copy(POS.homeRouter);
    scene.add(homeRouterObj.group);

    const northNodeObj = createRouterGroup('#0ea5e9', 3);
    northNodeObj.group.position.copy(POS.nodeNorth);
    scene.add(northNodeObj.group);

    const southNodeObj = createRouterGroup('#8b5cf6', 3);
    southNodeObj.group.position.copy(POS.nodeSouth);
    scene.add(southNodeObj.group);

    const destRouterObj = createRouterGroup('#14b8a6', 2);
    destRouterObj.group.position.copy(POS.destRouter);
    scene.add(destRouterObj.group);

    // Connection Paths between nodes
    const linkPairs: [THREE.Vector3, THREE.Vector3][] = [
      [POS.sender, POS.homeRouter],
      [POS.homeRouter, POS.nodeNorth],
      [POS.homeRouter, POS.nodeSouth],
      [POS.nodeNorth, POS.nodeSouth], // Core cross-link
      [POS.nodeNorth, POS.destRouter],
      [POS.nodeSouth, POS.destRouter],
      [POS.destRouter, POS.receiver]
    ];

    const cableMeshes: THREE.Mesh[] = [];
    const wirelessRings: THREE.Mesh[] = [];

    linkPairs.forEach(([start, end]) => {
      const p1 = start.clone().setY(0.32);
      const p2 = end.clone().setY(0.32);
      const curve = new THREE.LineCurve3(p1, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.065, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.25,
        roughness: 0.3
      });
      const mesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(mesh);
      cableMeshes.push(mesh);

      // Create wireless wave rings along each path (visible when medium === 'wireless')
      const mid = p1.clone().lerp(p2, 0.5);
      for (let r = 0; r < 3; r++) {
        const waveRing = new THREE.Mesh(
          new THREE.RingGeometry(0.18 + r * 0.14, 0.23 + r * 0.14, 24),
          new THREE.MeshBasicMaterial({ color: '#a855f7', side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
        );
        waveRing.position.copy(mid);
        waveRing.position.y = 0.65;
        waveRing.rotation.x = Math.PI / 2;
        waveRing.visible = false;
        scene.add(waveRing);
        wirelessRings.push(waveRing);
      }
    });

    // Floating Binary Bits Visual Group (Stage 2 highlight)
    const binaryBitsGroup = new THREE.Group();
    const bitOrbs: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const isOne = i % 2 === 0;
      const orb = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.36, 0.12),
        new THREE.MeshStandardMaterial({
          color: isOne ? '#8b5cf6' : '#06b6d4',
          emissive: isOne ? '#6d28d9' : '#0891b2',
          emissiveIntensity: 0.35
        })
      );
      orb.position.set(-7.4 + i * 0.34, 1.35 + Math.sin(i) * 0.15, 0);
      binaryBitsGroup.add(orb);
      bitOrbs.push(orb);
    }
    scene.add(binaryBitsGroup);

    // 3 Animated Data Packets with distinct colors (Orange, Cyan, Purple) + Header cap
    const packetConfigs = [
      { id: 1, color: '#f97316', headerColor: '#fde047', label: 'PKT #1', route: 'north' },
      { id: 2, color: '#06b6d4', headerColor: '#fde047', label: 'PKT #2', route: 'south' },
      { id: 3, color: '#8b5cf6', headerColor: '#fde047', label: 'PKT #3', route: 'north' }
    ];

    const packetMeshes = packetConfigs.map((cfg) => {
      const pktGroup = new THREE.Group();

      // Payload box
      const payloadMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.36, 0.36),
        new THREE.MeshStandardMaterial({
          color: cfg.color,
          emissive: cfg.color,
          emissiveIntensity: 0.3,
          roughness: 0.2
        })
      );
      payloadMesh.castShadow = true;
      pktGroup.add(payloadMesh);

      // Header band on the front of the packet
      const headerMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.38, 0.38),
        new THREE.MeshStandardMaterial({
          color: cfg.headerColor,
          emissive: '#facc15',
          emissiveIntensity: 0.4,
          roughness: 0.2
        })
      );
      headerMesh.position.x = 0.26;
      pktGroup.add(headerMesh);

      // Glow halo around packet
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 16, 16),
        new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.18
        })
      );
      pktGroup.add(halo);

      pktGroup.position.copy(POS.sender).setY(0.8);
      scene.add(pktGroup);
      return { cfg, group: pktGroup, halo };
    });

    // Sender & Receiver Message Envelope Indicators
    const messageBlockSender = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.55, 0.15),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.3 })
    );
    messageBlockSender.position.set(POS.sender.x, 2.25, 0);
    scene.add(messageBlockSender);

    const messageBlockReceiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.55, 0.15),
      new THREE.MeshStandardMaterial({ color: '#10b981', emissive: '#059669', emissiveIntensity: 0.3 })
    );
    messageBlockReceiver.position.set(POS.receiver.x, 2.25, 0);
    messageBlockReceiver.visible = false;
    scene.add(messageBlockReceiver);

    // Mouse / Touch Camera Orbit Listeners
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      stateRef.current.isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      stateRef.current.prevMouse = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!stateRef.current.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - stateRef.current.prevMouse.x;
      const dy = clientY - stateRef.current.prevMouse.y;
      stateRef.current.prevMouse = { x: clientX, y: clientY };

      stateRef.current.cameraAngle.theta -= dx * 0.007;
      stateRef.current.cameraAngle.phi = Math.max(
        0.2,
        Math.min(1.35, stateRef.current.cameraAngle.phi + dy * 0.006)
      );
    };

    const onPointerUp = () => {
      stateRef.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stateRef.current.cameraAngle.distance = Math.max(
        6,
        Math.min(22, stateRef.current.cameraAngle.distance + e.deltaY * 0.01)
      );
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    // Helper function to interpolate position along a multi-node route
    const getPointAlongRoute = (waypoints: THREE.Vector3[], tNorm: number) => {
      const clamped = Math.max(0, Math.min(1, tNorm));
      const totalSegments = waypoints.length - 1;
      const scaled = clamped * totalSegments;
      const segIdx = Math.min(Math.floor(scaled), totalSegments - 1);
      const localT = scaled - segIdx;
      const pStart = waypoints[segIdx];
      const pEnd = waypoints[segIdx + 1];
      const pos = new THREE.Vector3().lerpVectors(pStart, pEnd, localT);
      pos.y = 0.68 + Math.sin(localT * Math.PI) * 0.28; // gentle arc between hops
      return pos;
    };

    // Main deterministic educational animation loop
    let animFrameId: number;
    let lastTime = performance.now();
    let lastPhaseReported = '';

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const st = stateRef.current;
      const speedMult = st.isSlowMo ? 0.35 : 1.0;

      if (st.isPlaying) {
        st.simTime += dt * speedMult;
      }

      // Cycle duration is 12 seconds for a full end-to-end journey
      const cycleDuration = 12.0;
      const t = st.simTime % cycleDuration;

      // Update Medium visuals (Fiber = cyan glow, Copper = warm amber, Wireless = dashed/wave rings)
      cableMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (st.medium === 'fiber') {
          mesh.visible = true;
          mat.color.set('#22d3ee');
          mat.emissive.set('#0891b2');
          mat.emissiveIntensity = 0.45 + Math.sin(now * 0.008) * 0.2;
        } else if (st.medium === 'copper') {
          mesh.visible = true;
          mat.color.set('#f59e0b');
          mat.emissive.set('#b45309');
          mat.emissiveIntensity = 0.25;
        } else {
          // Wireless hides solid cables and reveals radio wave rings
          mesh.visible = false;
        }
      });

      wirelessRings.forEach((ring, idx) => {
        ring.visible = st.medium === 'wireless';
        if (ring.visible) {
          const scale = 0.8 + ((now * 0.002 + idx * 0.3) % 1.4);
          ring.scale.set(scale, scale, 1);
          (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 1.1 - scale * 0.65);
        }
      });

      // Stage-specific focus or full cycle phase calculation
      // Depending on currentStage, we emphasize that stage's action clearly
      let currentPhaseText = '';

      // 1. Sender message block animation
      messageBlockSender.rotation.y = now * 0.0015;
      messageBlockSender.position.y = 2.2 + Math.sin(now * 0.004) * 0.12;
      messageBlockSender.visible = st.currentStage === 1 || t < 2.2;

      // 2. Binary bits visualization (Stage 2 or t between 1.5 and 3.5)
      const showBinary = st.currentStage === 2 || (t >= 1.2 && t <= 3.6);
      binaryBitsGroup.visible = showBinary;
      bitOrbs.forEach((orb, idx) => {
        orb.position.y = 1.35 + Math.sin(now * 0.006 + idx * 0.9) * 0.18;
        orb.rotation.y = now * 0.003;
      });

      // 3. Packet positions along network paths
      const northWaypoints = [POS.sender, POS.homeRouter, POS.nodeNorth, POS.destRouter, POS.receiver];
      const southWaypoints = [POS.sender, POS.homeRouter, POS.nodeSouth, POS.destRouter, POS.receiver];

      packetMeshes.forEach((pkt, idx) => {
        // Decide route for each packet
        let useNorth = idx !== 1; // Packet 1 & 3 go North, Packet 2 goes South by default
        if (st.routeChoice === 'north') useNorth = true;
        if (st.routeChoice === 'south') useNorth = false;

        const waypoints = useNorth ? northWaypoints : southWaypoints;

        // Calculate packet normalized progress [0..1] based on stage or timeline
        let pktProgress = 0;
        const stagger = idx * 0.08;

        if (st.currentStage === 1) {
          pkt.group.visible = false;
          currentPhaseText = 'Stage 1: Creating message on Sender Device';
        } else if (st.currentStage === 2) {
          pkt.group.visible = false;
          currentPhaseText = 'Stage 2: Encoding characters into Binary Bits (0s & 1s)';
        } else if (st.currentStage === 3) {
          pkt.group.visible = true;
          // Hover near homeRouter showing split into 3 distinct packets with headers
          const spreadX = -5.8 + idx * 0.95;
          pkt.group.position.set(spreadX, 1.15 + Math.sin(now * 0.004 + idx) * 0.1, (idx - 1) * 0.65);
          pkt.group.rotation.y = now * 0.002;
          currentPhaseText = 'Stage 3: Splitting binary stream into 3 labeled Packets + Headers';
        } else {
          // Stages 4, 5, 6: Packets actively traverse the network
          pkt.group.visible = true;
          const rawP = ((t / cycleDuration) * 1.25) - stagger;
          pktProgress = Math.max(0, Math.min(1, rawP));
          const pos = getPointAlongRoute(waypoints, pktProgress);
          // Slight lateral offset when idling at endpoints so packets don't overlap
          if (pktProgress >= 0.98) {
            pos.z += (idx - 1) * 0.55;
            pos.y = 1.1;
          }
          pkt.group.position.copy(pos);
          pkt.group.rotation.y = 0;

          if (pktProgress < 0.25) {
            currentPhaseText = 'Packets leaving Sender toward Home Router';
          } else if (pktProgress < 0.75) {
            currentPhaseText = `Routing across ${
              st.routeChoice === 'auto' ? 'North & South Relay Nodes' : st.routeChoice.toUpperCase() + ' Relay Path'
            } via ${st.medium.toUpperCase()}`;
          } else {
            currentPhaseText = 'Stage 6: Packets arriving & reassembling at Receiver!';
          }
        }

        // Update active packet telemetry for Packet #1
        if (idx === 0) {
          const msgClean = (st.customMessage || 'HELLO!').padEnd(6, '!');
          const chunkLen = Math.max(1, Math.ceil(msgClean.length / 3));
          const chunkStr = msgClean.slice(0, chunkLen);
          setActivePacketInfo({
            id: 1,
            seq: '1 of 3',
            chunk: chunkStr,
            route: useNorth ? 'North Relay (Node A)' : 'South Relay (Node B)',
            progress: Math.round(pktProgress * 100)
          });
        }
      });

      // 4. Receiver reconstructed message block
      const showReceived =
        st.currentStage === 6 || (st.currentStage >= 4 && t > cycleDuration * 0.78);
      messageBlockReceiver.visible = showReceived;
      if (showReceived) {
        messageBlockReceiver.rotation.y = now * 0.002;
        messageBlockReceiver.position.y = 2.25 + Math.sin(now * 0.005) * 0.12;
      }

      if (currentPhaseText !== lastPhaseReported) {
        lastPhaseReported = currentPhaseText;
        setSimPhaseLabel(currentPhaseText);
      }

      // 5. Smooth Camera Positioning (either Follow-the-Packet mode or Stage target with user orbit)
      const stageCfg = STAGES[st.currentStage - 1] || STAGES[0];
      let desiredTarget = new THREE.Vector3(...stageCfg.cameraTarget);

      if (st.followPacket && st.currentStage >= 3 && packetMeshes[0].group.visible) {
        desiredTarget.copy(packetMeshes[0].group.position);
      }

      st.cameraTargetOffset.lerp(desiredTarget, 0.06);

      const dist = st.followPacket ? 6.2 : st.cameraAngle.distance;
      const camX =
        st.cameraTargetOffset.x +
        dist * Math.sin(st.cameraAngle.theta) * Math.cos(st.cameraAngle.phi);
      const camY = st.cameraTargetOffset.y + dist * Math.sin(st.cameraAngle.phi);
      const camZ =
        st.cameraTargetOffset.z +
        dist * Math.cos(st.cameraAngle.theta) * Math.cos(st.cameraAngle.phi);

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
      camera.lookAt(st.cameraTargetOffset);

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    // Handle responsive resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElem.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  // Fallback UI if WebGL is disabled
  if (webglError) {
    return (
      <div className="w-full h-full bg-sky-50 rounded-2xl border-2 border-sky-200 flex flex-col items-center justify-center p-6 text-center">
        <Network className="w-12 h-12 text-sky-600 mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-1">Interactive 2D Network Diagram Mode</h3>
        <p className="text-sm text-slate-600 max-w-md mb-4">{webglError}</p>
        <div className="flex items-center gap-3 flex-wrap justify-center bg-white p-4 rounded-xl shadow-sm border border-sky-100">
          <span className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-800 font-semibold text-xs">
            💻 Sender ({customMessage})
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <span className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-800 font-semibold text-xs">
            📡 Home Router
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-semibold text-xs">
            📦 3 Packets ({medium.toUpperCase()})
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs">
            🖥️ Receiver
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gradient-to-b from-sky-100 to-white border-2 border-sky-200 shadow-inner">
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Live Telemetry Pill */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-sky-200 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">{simPhaseLabel}</span>
        </div>

        <div className="bg-sky-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-full shadow-sm text-xs font-medium flex items-center gap-2">
          <span>Medium: <strong className="text-cyan-300 uppercase">{medium}</strong></span>
          <span>•</span>
          <span>Drag to Orbit 3D • Scroll to Zoom</span>
        </div>
      </div>

      {/* Top-Right Node Legend */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-sm border border-sky-200 hidden sm:flex flex-col gap-1 text-[11px] text-slate-700 pointer-events-none">
        <div className="font-bold text-slate-800 border-b border-slate-100 pb-0.5 mb-0.5">3D Network Legend</div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 inline-block" /> Sender Computer (Left)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Routers & Relay Nodes (Center)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" /> Data Packets + Yellow Header
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Receiver Computer (Right)
        </div>
      </div>

      {/* Live Packet Inspector Overlay (Stages 3-6) */}
      {currentStage >= 3 && activePacketInfo && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-md border border-amber-200 max-w-xs pointer-events-none">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              Live Packet #1 Header
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Seq: {activePacketInfo.seq}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-700">
            <div><span className="text-slate-400">Src:</span> 192.168.1.10</div>
            <div><span className="text-slate-400">Dst:</span> 10.0.4.25</div>
            <div><span className="text-slate-400">Payload:</span> "{activePacketInfo.chunk}"</div>
            <div><span className="text-slate-400">Hop:</span> {activePacketInfo.route}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. HANDS-ON STAGE CHALLENGES COMPONENT
// ============================================================================

interface ChallengeModalProps {
  stage: StageConfig;
  customMessage: string;
  isAlreadyCompleted: boolean;
  onCompleteChallenge: (stageId: number, pointsEarned: number) => void;
  onClose: () => void;
}

const StageChallengePanel: React.FC<ChallengeModalProps> = ({
  stage,
  customMessage,
  isAlreadyCompleted,
  onCompleteChallenge,
  onClose
}) => {
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);

  // Stage 1 state: Identify next stage
  const [s1Choice, setS1Choice] = useState<string | null>(null);

  // Stage 2 state: Arrange pipeline in order
  const [s2Order, setS2Order] = useState<string[]>([
    'Split into Network Packets',
    'Create Message on Device',
    'Route Across Nodes',
    'Encode into Binary (Bits & Bytes)'
  ]);

  // Stage 3 state: Packet Header builder
  const [s3HeaderDest, setS3HeaderDest] = useState<string>('');
  const [s3HeaderSeq, setS3HeaderSeq] = useState<string>('');
  const [s3HeaderPayload, setS3HeaderPayload] = useState<string>('');

  // Stage 4 state: Routing congestion choice
  const [s4RouteChoice, setS4RouteChoice] = useState<string>('');

  // Stage 5 state: Match media descriptions
  const [s5Matches, setS5Matches] = useState<{
    fiber: string;
    copper: string;
    wireless: string;
  }>({ fiber: '', copper: '', wireless: '' });

  // Stage 6 state: Reassemble shuffled packets + diagnose
  const msgPadded = (customMessage || 'HELLO!').padEnd(6, '!');
  const c1 = msgPadded.slice(0, 2);
  const c2 = msgPadded.slice(2, 4);
  const c3 = msgPadded.slice(4, 6);

  const [s6Packets, setS6Packets] = useState<
    Array<{ seq: number; text: string; color: string }>
  >([
    { seq: 3, text: c3, color: 'bg-purple-100 border-purple-400 text-purple-900' },
    { seq: 1, text: c1, color: 'bg-orange-100 border-orange-400 text-orange-900' },
    { seq: 2, text: c2, color: 'bg-cyan-100 border-cyan-400 text-cyan-900' }
  ]);
  const [s6Diagnosis, setS6Diagnosis] = useState<string>('');

  const moveItem = <T,>(arr: T[], fromIdx: number, toIdx: number): T[] => {
    const copy = [...arr];
    const [removed] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, removed);
    return copy;
  };

  const handleVerify = () => {
    soundFX.playClick();

    if (stage.id === 1) {
      if (s1Choice === 'encode') {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message:
            'Spot on! Before your message can be packetized or transmitted as physical signals, your computer encodes the characters into binary bits and bytes.'
        });
        onCompleteChallenge(1, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message:
            'Not quite! Think about how a computer represents text internally before it can slice data into packets or send light pulses through fiber cables.'
        });
      }
    } else if (stage.id === 2) {
      const target = [
        'Create Message on Device',
        'Encode into Binary (Bits & Bytes)',
        'Split into Network Packets',
        'Route Across Nodes'
      ];
      const isMatch = s2Order.every((val, i) => val === target[i]);
      if (isMatch) {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message:
            'Excellent sequence! First you create content, then encode it into binary bits/bytes, then slice it into labeled packets, and finally route those packets across network nodes.'
        });
        onCompleteChallenge(2, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message:
            'Check the order again! Remember: 1) Create content -> 2) Encode to Binary -> 3) Split into Packets -> 4) Route across nodes.'
        });
      }
    } else if (stage.id === 3) {
      if (
        s3HeaderDest === '10.0.4.25 (Receiver)' &&
        s3HeaderSeq === 'Packet 2 of 3' &&
        s3HeaderPayload === 'Binary Chunk #2'
      ) {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message:
            'Perfect packet construction! The header carries the Destination IP and Sequence Number (2 of 3), while the payload carries Binary Chunk #2.'
        });
        onCompleteChallenge(3, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message:
            'One or more packet fields are inaccurate. Make sure the Destination points to the Receiver (10.0.4.25), the Sequence is Packet 2 of 3, and the Payload holds Binary Chunk #2.'
        });
      }
    } else if (stage.id === 4) {
      if (s4RouteChoice === 'south') {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message:
            'Great routing decision! Because Relay Node A (North) is congested, forwarding packets through Relay Node B (South) avoids packet drops and delays.'
        });
        onCompleteChallenge(4, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message:
            'Look closely at the node status! Relay Node A (North) is at 98% congestion, and dropping all packets stops delivery. Try routing via the clear Southern Relay (Node B).'
        });
      }
    } else if (stage.id === 5) {
      if (
        s5Matches.fiber === 'light' &&
        s5Matches.copper === 'electricity' &&
        s5Matches.wireless === 'radio'
      ) {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message:
            'All 3 transmission media matched accurately! Fiber-optic uses light pulses, copper Ethernet uses electrical signals, and Wi-Fi uses radio waves.'
        });
        onCompleteChallenge(5, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message:
            'Not all media match their signal type! Hint: Glass fibers carry light, metal copper wires carry electricity, and wireless antennas broadcast radio waves.'
        });
      }
    } else if (stage.id === 6) {
      const orderedCorrectly =
        s6Packets[0].seq === 1 && s6Packets[1].seq === 2 && s6Packets[2].seq === 3;
      const diagCorrect = s6Diagnosis === 'retransmit';
      if (orderedCorrectly && diagCorrect) {
        soundFX.playSuccess();
        setFeedback({
          correct: true,
          message: `Mission Accomplished! You sorted the packets into [1 → 2 → 3] to reconstruct "${msgPadded}" and accurately diagnosed how TCP requests retransmission of a missing packet.`
        });
        onCompleteChallenge(6, 100);
      } else {
        soundFX.playError();
        setFeedback({
          correct: false,
          message: !orderedCorrectly
            ? 'The packets are still out of order! Move them so Packet #1 is first, Packet #2 is second, and Packet #3 is third.'
            : 'Your packet order is right, but check the diagnostic question below: what does the receiver do when one packet goes missing?'
        });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-sky-200 shadow-lg p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Hands-On Challenge • +100 pts
            </span>
            {isAlreadyCompleted && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </span>
            )}
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 mt-1">{stage.challenge.title}</h3>
          <p className="text-sm text-slate-600 mt-0.5">{stage.challenge.instruction}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
        >
          Back to Lesson
        </button>
      </div>

      {/* STAGE 1 CHALLENGE UI */}
      {stage.id === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'encode',
              title: 'Digital Encoding (Bits & Bytes)',
              desc: 'Convert characters into binary 0s and 1s so hardware can process them.'
            },
            {
              id: 'laser',
              title: 'Shoot Raw Paper Letters into Cable',
              desc: 'Push the physical keyboard letters directly into the router cord.'
            },
            {
              id: 'reassemble',
              title: 'Reassemble Packets First',
              desc: 'Put packets back in order before the message has even been encoded.'
            }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                soundFX.playClick();
                setS1Choice(opt.id);
              }}
              className={`p-3.5 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                s1Choice === opt.id
                  ? 'border-sky-500 bg-sky-50 shadow-sm'
                  : 'border-slate-200 hover:border-sky-300 bg-white'
              }`}
            >
              <div className="font-bold text-sm text-slate-800 mb-1">{opt.title}</div>
              <div className="text-xs text-slate-600">{opt.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* STAGE 2 CHALLENGE UI */}
      {stage.id === 2 && (
        <div className="flex flex-col gap-2">
          {s2Order.map((item, idx) => (
            <div
              key={item}
              className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold text-slate-800">{item}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={idx === 0}
                  onClick={() => {
                    soundFX.playClick();
                    setS2Order((prev) => moveItem(prev, idx, idx - 1));
                  }}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-sky-50 disabled:opacity-40"
                >
                  ↑ Up
                </button>
                <button
                  disabled={idx === s2Order.length - 1}
                  onClick={() => {
                    soundFX.playClick();
                    setS2Order((prev) => moveItem(prev, idx, idx + 1));
                  }}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-sky-50 disabled:opacity-40"
                >
                  ↓ Down
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STAGE 3 CHALLENGE UI */}
      {stage.id === 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Header: Destination Address
            </label>
            <select
              value={s3HeaderDest}
              onChange={(e) => setS3HeaderDest(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="">-- Select Destination --</option>
              <option value="10.0.4.25 (Receiver)">10.0.4.25 (Receiver)</option>
              <option value="0.0.0.0 (Nowhere)">0.0.0.0 (Nowhere)</option>
              <option value="192.168.1.10 (Back to Self)">192.168.1.10 (Back to Self)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              2. Header: Sequence Number
            </label>
            <select
              value={s3HeaderSeq}
              onChange={(e) => setS3HeaderSeq(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="">-- Select Sequence # --</option>
              <option value="No Sequence Needed">No Sequence Needed</option>
              <option value="Packet 2 of 3">Packet 2 of 3</option>
              <option value="Packet 99 of 1">Packet 99 of 1</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              3. Packet Payload Data
            </label>
            <select
              value={s3HeaderPayload}
              onChange={(e) => setS3HeaderPayload(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="">-- Select Payload --</option>
              <option value="Entire 50GB Hard Drive">Entire 50GB Hard Drive</option>
              <option value="Binary Chunk #2">Binary Chunk #2 ("{c2}")</option>
              <option value="Empty Payload">Empty Payload</option>
            </select>
          </div>
        </div>
      )}

      {/* STAGE 4 CHALLENGE UI */}
      {stage.id === 4 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'north',
              title: 'Force North Path (Node A)',
              status: '⚠️ 98% Congested / High Delay',
              color: 'border-rose-200 bg-rose-50/40'
            },
            {
              id: 'south',
              title: 'Route via South Path (Node B)',
              status: '✅ 15% Load / Clear High-Speed Path',
              color: 'border-emerald-200 bg-emerald-50/40'
            },
            {
              id: 'drop',
              title: 'Delete All Packets Immediately',
              status: '❌ Cancels User Transmission',
              color: 'border-slate-200 bg-slate-50'
            }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                soundFX.playClick();
                setS4RouteChoice(opt.id);
              }}
              className={`p-3.5 rounded-xl border-2 text-left transition ${
                s4RouteChoice === opt.id
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-200'
                  : opt.color
              }`}
            >
              <div className="font-bold text-sm text-slate-800">{opt.title}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">{opt.status}</div>
            </button>
          ))}
        </div>
      )}

      {/* STAGE 5 CHALLENGE UI */}
      {stage.id === 5 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: 'fiber' as const, label: '✨ Fiber-Optic Cable' },
            { key: 'copper' as const, label: '⚡ Copper Ethernet Wire' },
            { key: 'wireless' as const, label: '📡 Wireless (Wi-Fi / 5G)' }
          ].map((item) => (
            <div key={item.key} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-extrabold text-slate-800 mb-2">{item.label}</div>
              <select
                value={s5Matches[item.key]}
                onChange={(e) =>
                  setS5Matches((prev) => ({ ...prev, [item.key]: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                <option value="">-- How does it send signals? --</option>
                <option value="light">Pulses of Light through glass strands</option>
                <option value="electricity">Electrical voltage across metal wires</option>
                <option value="radio">Radio frequency waves through the air</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* STAGE 6 CHALLENGE UI */}
      {stage.id === 6 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-700">
            Part A: Sort Arrived Packets by Sequence Number (1 → 2 → 3):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {s6Packets.map((pkt, idx) => (
              <div
                key={pkt.seq}
                className={`p-3 rounded-xl border-2 flex flex-col justify-between ${pkt.color}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase">Packet #{pkt.seq} of 3</span>
                  <span className="text-[11px] font-bold bg-white/80 px-2 py-0.5 rounded">
                    Slot {idx + 1}
                  </span>
                </div>
                <div className="my-2 font-mono text-base font-black text-center bg-white/90 py-1.5 rounded border border-black/10">
                  "{pkt.text}"
                </div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => {
                      soundFX.playClick();
                      setS6Packets((prev) => moveItem(prev, idx, idx - 1));
                    }}
                    className="flex-1 py-1 rounded bg-white hover:bg-slate-50 text-xs font-bold border border-black/10 disabled:opacity-40"
                  >
                    ← Move Left
                  </button>
                  <button
                    disabled={idx === s6Packets.length - 1}
                    onClick={() => {
                      soundFX.playClick();
                      setS6Packets((prev) => moveItem(prev, idx, idx + 1));
                    }}
                    className="flex-1 py-1 rounded bg-white hover:bg-slate-50 text-xs font-bold border border-black/10 disabled:opacity-40"
                  >
                    Move Right →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 mt-1">
            <label className="block text-xs font-bold text-indigo-950 mb-1.5">
              Part B: Network Diagnostic — What if Packet #2 was lost due to router interference?
            </label>
            <select
              value={s6Diagnosis}
              onChange={(e) => setS6Diagnosis(e.target.value)}
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="">-- Select accurate protocol behavior --</option>
              <option value="retransmit">
                The receiver notices #2 is missing and requests the sender to retransmit Packet #2.
              </option>
              <option value="guess">
                The receiver guesses random words to fill in the missing gap.
              </option>
              <option value="burn">
                The entire Internet shuts down until you buy a new monitor.
              </option>
            </select>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
            feedback.correct
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedback.correct ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{feedback.message}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          onClick={handleVerify}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-sm transition flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" /> Check My Answer
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 6. MAIN APPLICATION COMPONENT
// ============================================================================

const STORAGE_KEY = 'how_data_travels_progress_v1';

export default function App() {
  // Load saved learning progress from localStorage
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // ignore storage errors
    }
    return {
      completedStages: [],
      stageScores: {},
      selectedMessageType: 'text',
      customMessage: 'HELLO!',
      preferredMedium: 'fiber',
      preferredRoute: 'auto'
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      // ignore storage errors
    }
  }, [progress]);

  // Navigation & UI state
  const [screen, setScreen] = useState<ScreenMode>('welcome');
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0); // 0..5
  const [showChallenge, setShowChallenge] = useState<boolean>(false);

  // 3D Simulation controls state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isSlowMo, setIsSlowMo] = useState<boolean>(false);
  const [followPacket, setFollowPacket] = useState<boolean>(false);
  const [replayTrigger, setReplayTrigger] = useState<number>(0);

  // Audio & Narration controls state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.7);
  const [bgmActive, setBgmActive] = useState<boolean>(false);
  const [isNarrating, setIsNarrating] = useState<boolean>(false);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);

  const currentStage = STAGES[currentStageIdx] || STAGES[0];

  const totalScore = useMemo(() => {
    return Object.values(progress.stageScores).reduce((acc, v) => acc + v, 0);
  }, [progress.stageScores]);

  const starRating = useMemo(() => {
    const count = progress.completedStages.length;
    if (count >= 6) return 3;
    if (count >= 3) return 2;
    if (count >= 1) return 1;
    return 0;
  }, [progress.completedStages]);

  useEffect(() => {
    return () => {
      soundFX.cleanup();
    };
  }, []);

  // Helper to convert custom message to binary visualization for Stage 2
  const binaryPreview = useMemo(() => {
    const msg = (progress.customMessage || 'HELLO!').slice(0, 6);
    return msg.split('').map((ch) => ({
      char: ch,
      bin: ch.charCodeAt(0).toString(2).padStart(8, '0')
    }));
  }, [progress.customMessage]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.isMuted = next;
    if (next) {
      soundFX.stopNarration();
      setIsNarrating(false);
      soundFX.toggleBGM(false);
    } else if (bgmActive) {
      soundFX.toggleBGM(true);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    soundFX.volume = val;
  };

  const handleToggleBgm = () => {
    const next = soundFX.toggleBGM();
    setBgmActive(next);
  };

  const handleNarrateStage = () => {
    if (isNarrating) {
      soundFX.stopNarration();
      setIsNarrating(false);
    } else {
      setIsNarrating(true);
      soundFX.speakNarration(currentStage.narrationText, () => {
        setIsNarrating(false);
      });
    }
  };

  const handleCompleteChallenge = useCallback((stageId: number, pts: number) => {
    setProgress((prev) => {
      const completed = prev.completedStages.includes(stageId)
        ? prev.completedStages
        : [...prev.completedStages, stageId];
      return {
        ...prev,
        completedStages: completed,
        stageScores: {
          ...prev.stageScores,
          [stageId]: Math.max(prev.stageScores[stageId] || 0, pts)
        }
      };
    });
  }, []);

  const handleResetProgress = () => {
    soundFX.playClick();
    const fresh: UserProgress = {
      completedStages: [],
      stageScores: {},
      selectedMessageType: 'text',
      customMessage: 'HELLO!',
      preferredMedium: 'fiber',
      preferredRoute: 'auto'
    };
    setProgress(fresh);
    setCurrentStageIdx(0);
    setShowChallenge(false);
  };

  const goToStage = (idx: number) => {
    soundFX.playClick();
    soundFX.stopNarration();
    setIsNarrating(false);
    setCurrentStageIdx(idx);
    setShowChallenge(false);
    setScreen('stage');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-800 flex flex-col font-sans selection:bg-sky-200">
      {/* =====================================================================
          TOP NAVIGATION & AUDIO CONTROL BAR
      ===================================================================== */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-sky-100 shadow-sm px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundFX.playClick();
                setScreen('welcome');
              }}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-none">
                  How Data Travels
                </span>
                <span className="text-[11px] font-semibold text-sky-600">
                  Interactive 3D Network Lab
                </span>
              </div>
            </button>

            {/* Quick Nav Pills */}
            <nav className="hidden md:flex items-center gap-1 ml-4 bg-sky-50 p-1 rounded-xl border border-sky-100">
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('welcome');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  screen === 'welcome'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('intro');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  screen === 'intro'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('stage');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  screen === 'stage'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3D Stages ({progress.completedStages.length}/6)
              </button>
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('final');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  screen === 'final'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mission Results
              </button>
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('docs');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  screen === 'docs'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> README
              </button>
            </nav>
          </div>

          {/* Score & Audio Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Score Badge */}
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-extrabold text-amber-900">{totalScore} pts</span>
            </div>

            {/* Audio Toolbar */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              <button
                onClick={handleToggleMute}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-600" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Audio Volume"
                className="w-14 sm:w-20 accent-sky-600 cursor-pointer"
              />

              <button
                onClick={handleToggleBgm}
                title="Toggle Ambient Study Music"
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                  bgmActive && !isMuted
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Music</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: WELCOME LANDING SCREEN
      ===================================================================== */}
      {screen === 'welcome' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Hero Left Column */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs font-extrabold border border-sky-200">
                <Sparkles className="w-4 h-4 text-sky-600" /> Interactive 3D Computer Networking Adventure
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Discover How Your Digital Data Travels the World!
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                What really happens in the split second after you click <strong>Send</strong>? Step inside a bright, interactive 3D network laboratory to transform messages into binary bits, wrap them into labeled packets, route them across nodes, and reassemble them at their destination!
              </p>

              {/* Interactive Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    soundFX.playClick();
                    setScreen('intro');
                  }}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-extrabold text-base shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  Start Learning <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    soundFX.playClick();
                    setScreen('stage');
                  }}
                  className="px-5 py-3.5 rounded-2xl bg-white hover:bg-sky-50 text-sky-700 font-bold text-base border-2 border-sky-200 transition flex items-center gap-2 cursor-pointer"
                >
                  <Compass className="w-5 h-5" /> Jump to 3D Simulator
                </button>
              </div>

              {/* 6-Stage Quick Roadmap Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-4">
                {STAGES.map((st, i) => {
                  const done = progress.completedStages.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      onClick={() => goToStage(i)}
                      className="p-3 rounded-xl bg-white hover:bg-sky-50/70 border border-sky-100 shadow-sm text-left transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-sky-600">STAGE {st.id}</div>
                        <div className="text-xs font-extrabold text-slate-800 group-hover:text-sky-700">
                          {st.shortTitle.split('. ')[1]}
                        </div>
                      </div>
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero Right Column: Live 3D Preview Card */}
            <div className="lg:col-span-5 h-[380px] sm:h-[430px] flex flex-col gap-2">
              <div className="flex-1 rounded-3xl p-2 bg-white shadow-xl border-2 border-sky-100 relative">
                <ThreeNetworkViewport
                  currentStage={4}
                  isPlaying={true}
                  isSlowMo={false}
                  followPacket={false}
                  medium={progress.preferredMedium}
                  routeChoice="auto"
                  customMessage={progress.customMessage}
                  replayTrigger={0}
                />
              </div>
              <p className="text-center text-xs font-semibold text-slate-500">
                Live Interactive 3D Preview — Drag with your mouse or finger to orbit the network!
              </p>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 2: INTERACTIVE INTRODUCTION
      ===================================================================== */}
      {screen === 'intro' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border-2 border-sky-100 shadow-md p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 font-extrabold text-xs">
                Interactive Introduction
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Customize your test payload before entering Stage 1
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              The Journey of Digital Information
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
              Whenever you send a message, photo, or file over the Internet, it doesn't teleport魔法-style, and it doesn't travel as one giant unbroken block. Instead, computer networks rely on a clever 6-stage pipeline that encodes, slices, routes, transmits, and reassembles your data in milliseconds!
            </p>

            {/* Interactive Payload Customizer */}
            <div className="bg-sky-50/80 rounded-2xl p-5 border border-sky-200 mb-6">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-600" /> Step 0: Choose What You Want to Send Across Our 3D Network
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type a 6-character sample message to trace inside packets:
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={progress.customMessage}
                    onChange={(e) =>
                      setProgress((p) => ({
                        ...p,
                        customMessage: e.target.value.toUpperCase() || 'HELLO!'
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-sky-300 bg-white font-mono font-bold text-slate-900 text-sm focus:outline-none focus:border-sky-500"
                    placeholder="HELLO!"
                  />
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-sky-100 flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Live Packet Slicing Preview:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded bg-orange-100 text-orange-800 font-mono text-xs font-bold border border-orange-300">
                      Pkt #1: "{(progress.customMessage || 'HELLO!').padEnd(6, '!').slice(0, 2)}"
                    </span>
                    <span className="px-2.5 py-1 rounded bg-cyan-100 text-cyan-800 font-mono text-xs font-bold border border-cyan-300">
                      Pkt #2: "{(progress.customMessage || 'HELLO!').padEnd(6, '!').slice(2, 4)}"
                    </span>
                    <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-800 font-mono text-xs font-bold border border-purple-300">
                      Pkt #3: "{(progress.customMessage || 'HELLO!').padEnd(6, '!').slice(4, 6)}"
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual 6-Stage Pipeline Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {STAGES.map((st, idx) => (
                <div
                  key={st.id}
                  onClick={() => goToStage(idx)}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50/40 transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${st.badgeColor}`}>
                        Stage {st.id}
                      </span>
                      {progress.completedStages.includes(st.id) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 mb-1">{st.title.split(': ')[1]}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{st.subtitle}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-bold text-sky-600 flex items-center gap-1">
                    Explore Stage {st.id} <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  soundFX.playClick();
                  setScreen('welcome');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <button
                onClick={() => goToStage(0)}
                className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm shadow-md transition flex items-center gap-2"
              >
                Begin Stage 1: Creating Content <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 3: MAIN 6-STAGE INTERACTIVE 3D LEARNING WORKSPACE
      ===================================================================== */}
      {screen === 'stage' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-3 flex flex-col gap-3">
          {/* Sequential Stage Stepper Bar */}
          <div className="bg-white rounded-2xl p-2 border border-sky-100 shadow-sm flex items-center justify-between gap-1.5 overflow-x-auto">
            {STAGES.map((st, idx) => {
              const active = idx === currentStageIdx;
              const completed = progress.completedStages.includes(st.id);
              return (
                <button
                  key={st.id}
                  onClick={() => goToStage(idx)}
                  className={`flex-1 min-w-[115px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm'
                      : completed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {completed ? (
                    <CheckCircle2 className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-emerald-600'}`} />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-black/10 text-[10px] flex items-center justify-center">
                      {st.id}
                    </span>
                  )}
                  <span className="truncate">{st.shortTitle}</span>
                </button>
              );
            })}
          </div>

          {/* Split Workspace: Large 3D Viewport (Left 7 cols) + Compact Lesson/Challenge Panel (Right 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* LEFT COLUMN: 3D Simulation Viewport & Controls */}
            <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-[380px] lg:min-h-[520px]">
              <div className="flex-1 relative">
                <ThreeNetworkViewport
                  currentStage={currentStage.id}
                  isPlaying={isPlaying}
                  isSlowMo={isSlowMo}
                  followPacket={followPacket}
                  medium={progress.preferredMedium}
                  routeChoice={progress.preferredRoute}
                  customMessage={progress.customMessage}
                  replayTrigger={replayTrigger}
                />
              </div>

              {/* 3D Playback & Network Parameter Controls Bar */}
              <div className="bg-white rounded-2xl p-3 border border-sky-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
                {/* Play / Pause / Replay / Slow-Mo / Follow Camera */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      soundFX.playClick();
                      setIsPlaying(!isPlaying);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playPacketPulse(1);
                      setReplayTrigger((r) => r + 1);
                      setIsPlaying(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Replay
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playClick();
                      setIsSlowMo(!isSlowMo);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition ${
                      isSlowMo
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-100 border-transparent text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <FastForward className="w-3.5 h-3.5" /> {isSlowMo ? 'Slow-Mo ON' : 'Slow Motion'}
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playClick();
                      setFollowPacket(!followPacket);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition ${
                      followPacket
                        ? 'bg-purple-100 border-purple-300 text-purple-900'
                        : 'bg-slate-100 border-transparent text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> {followPacket ? 'Following Packet #1' : 'Follow Packet'}
                  </button>
                </div>

                {/* Medium & Route Selector Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                    {(['fiber', 'copper', 'wireless'] as TransmissionMedium[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          soundFX.playPacketPulse(2);
                          setProgress((p) => ({ ...p, preferredMedium: m }));
                        }}
                        className={`px-2.5 py-1 rounded-lg capitalize transition ${
                          progress.preferredMedium === m
                            ? 'bg-white text-sky-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {currentStage.id >= 4 && (
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                      {(['auto', 'north', 'south'] as RouteChoice[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            soundFX.playClick();
                            setProgress((p) => ({ ...p, preferredRoute: r }));
                          }}
                          className={`px-2 py-1 rounded-lg uppercase transition ${
                            progress.preferredRoute === r
                              ? 'bg-white text-emerald-700 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {r === 'auto' ? 'Split Route' : r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Compact Lesson Explanation OR Hands-On Challenge */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3">
              {!showChallenge ? (
                <div className="bg-white rounded-2xl border-2 border-sky-100 shadow-md p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex flex-col gap-3">
                    {/* Stage Header & Narration Button */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${currentStage.badgeColor}`}>
                        Stage {currentStage.id} of 6
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleNarrateStage}
                          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                            isNarrating
                              ? 'bg-rose-100 border-rose-300 text-rose-800'
                              : 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          {isNarrating ? 'Stop Narration' : 'Read Aloud'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-snug">
                        {currentStage.title}
                      </h2>
                      <p className="text-xs font-semibold text-sky-700 mt-0.5">
                        {currentStage.subtitle}
                      </p>
                    </div>

                    {/* Main Explanation Summary */}
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      {currentStage.conceptSummary}
                    </p>

                    {/* Stage-Specific Interactive Mini-Widget */}
                    {currentStage.id === 1 && (
                      <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-slate-700">
                          Sender Message Payload:
                        </div>
                        <input
                          type="text"
                          maxLength={12}
                          value={progress.customMessage}
                          onChange={(e) =>
                            setProgress((p) => ({
                              ...p,
                              customMessage: e.target.value.toUpperCase() || 'HELLO!'
                            }))
                          }
                          className="px-3 py-1 rounded-lg border border-sky-300 bg-white font-mono text-xs font-bold text-sky-900 w-36"
                        />
                      </div>
                    )}

                    {currentStage.id === 2 && (
                      <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200">
                        <div className="text-[11px] font-bold text-purple-900 mb-1.5">
                          Conceptual Binary Encoding of "{progress.customMessage.slice(0, 6)}":
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {binaryPreview.map((item, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-1.5 rounded-lg border border-purple-200 text-center"
                            >
                              <div className="text-xs font-black text-purple-800">'{item.char}'</div>
                              <div className="text-[10px] font-mono text-slate-600">{item.bin}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bullet Key Concepts */}
                    <ul className="space-y-2">
                      {currentStage.detailedPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                          <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                            {i + 1}
                          </span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Technical Accuracy Callout */}
                    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 leading-relaxed">
                      <strong className="font-extrabold block mb-0.5 text-amber-800">
                        💡 Concept Check:
                      </strong>
                      {currentStage.accuracyNote}
                    </div>

                    {/* Narration Captions Box */}
                    {showCaptions && isNarrating && (
                      <div className="bg-slate-900 text-white p-3 rounded-xl text-xs leading-relaxed">
                        <span className="text-cyan-300 font-bold uppercase text-[10px] block mb-0.5">
                          Live Narration Captions:
                        </span>
                        "{currentStage.narrationText}"
                      </div>
                    )}
                  </div>

                  {/* Bottom CTA: Take Stage Challenge + Prev/Next Stage */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        soundFX.playClick();
                        setShowChallenge(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-extrabold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4" />
                      {progress.completedStages.includes(currentStage.id)
                        ? 'Replay Stage Challenge (+100 pts Earned)'
                        : `Take Stage ${currentStage.id} Hands-On Challenge`}
                    </button>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        disabled={currentStageIdx === 0}
                        onClick={() => goToStage(currentStageIdx - 1)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Previous Stage
                      </button>

                      {currentStageIdx < STAGES.length - 1 ? (
                        <button
                          onClick={() => goToStage(currentStageIdx + 1)}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          Next Stage ({STAGES[currentStageIdx + 1].shortTitle}) <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            soundFX.playSuccess();
                            setScreen('final');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          Finish & View Final Results <Award className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <StageChallengePanel
                    stage={currentStage}
                    customMessage={progress.customMessage}
                    isAlreadyCompleted={progress.completedStages.includes(currentStage.id)}
                    onCompleteChallenge={handleCompleteChallenge}
                    onClose={() => setShowChallenge(false)}
                  />

                  {/* Quick Next Stage button once challenge is solved */}
                  {progress.completedStages.includes(currentStage.id) && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-900">
                        🎉 Stage {currentStage.id} Verified! Ready for the next step?
                      </span>
                      {currentStageIdx < STAGES.length - 1 ? (
                        <button
                          onClick={() => goToStage(currentStageIdx + 1)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                        >
                          Continue to Stage {currentStage.id + 1} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            soundFX.playSuccess();
                            setScreen('final');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                        >
                          View Final Mission Results <Award className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 4: FINAL MISSION & RESULTS SCREEN
      ===================================================================== */}
      {screen === 'final' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border-2 border-sky-100 shadow-lg p-6 sm:p-8 text-center">
            {/* Stars Display */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {[1, 2, 3].map((starIdx) => (
                <div
                  key={starIdx}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm border ${
                    starIdx <= starRating
                      ? 'bg-amber-100 border-amber-300 text-amber-500 scale-105'
                      : 'bg-slate-100 border-slate-200 text-slate-300'
                  }`}
                >
                  ★
                </div>
              ))}
            </div>

            <h2 className="text-3xl font-black text-slate-900">
              {progress.completedStages.length === 6
                ? 'Master Network Architect! 🎉'
                : 'Your Network Learning Progress'}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mt-1">
              You have completed <strong>{progress.completedStages.length} of 6</strong> learning stages and earned{' '}
              <strong className="text-sky-700">{totalScore} / 600 points</strong>.
            </p>

            {/* Stage Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 my-6 text-left">
              {STAGES.map((st, idx) => {
                const isDone = progress.completedStages.includes(st.id);
                return (
                  <div
                    key={st.id}
                    className={`p-4 rounded-2xl border-2 flex flex-col justify-between ${
                      isDone
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-amber-50/40 border-amber-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Stage {st.id}
                        </span>
                        {isDone ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +100 pts
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Concept to Review
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">
                        {st.title.split(': ')[1]}
                      </h4>
                      <p className="text-xs text-slate-600">{st.subtitle}</p>
                    </div>

                    <button
                      onClick={() => goToStage(idx)}
                      className="mt-3 pt-2 border-t border-black/5 text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center justify-between"
                    >
                      <span>{isDone ? 'Replay Stage & 3D Scene' : 'Complete Stage Now'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Key Takeaways Summary Box */}
            <div className="bg-sky-50 rounded-2xl p-5 border border-sky-200 text-left mb-6">
              <h3 className="text-sm font-extrabold text-sky-950 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600" /> Core Networking Concepts to Remember
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 leading-relaxed">
                <div className="bg-white p-3 rounded-xl border border-sky-100">
                  <strong>1. Binary Encoding ≠ Packetization:</strong> Encoding turns characters or pixels into bits (0s and 1s), whereas packetization slices binary data into chunks with addressing headers.
                </div>
                <div className="bg-white p-3 rounded-xl border border-sky-100">
                  <strong>2. Dynamic Multi-Path Routing:</strong> Packets from the same file can travel through different routers and arrive out of order before being reassembled by sequence number.
                </div>
                <div className="bg-white p-3 rounded-xl border border-sky-100">
                  <strong>3. Route vs. Transmission Medium:</strong> A logical route is the path of routers visited; the physical medium (Fiber light, Copper electricity, Wireless radio) is how signals travel between hops.
                </div>
                <div className="bg-white p-3 rounded-xl border border-sky-100">
                  <strong>4. Reliable Reassembly:</strong> Receiving computers use packet sequence numbers to sort packets back into order and request retransmission if any packet is lost.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => goToStage(0)}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition flex items-center gap-2"
              >
                <Compass className="w-4 h-4" /> Explore 3D Simulator Again
              </button>

              <button
                onClick={handleResetProgress}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-sm transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Reset All Progress
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 5: PROJECT README & ARCHITECTURE DOCUMENTATION
      ===================================================================== */}
      {screen === 'docs' && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl border-2 border-sky-100 shadow-md p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase text-sky-600">
                  Project Documentation & Setup Guide
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  README.md — How Data Travels (3D Educational Game)
                </h2>
              </div>
              <button
                onClick={() => setScreen('stage')}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                Back to Game
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base mb-1">
                  1. Overview & Pedagogical Design
                </h3>
                <p>
                  <strong>How Data Travels</strong> is an interactive 3D educational web game that teaches learners how digital data travels from a sender device to a receiver across a computer network through 6 sequential stages: Content Creation, Binary Encoding, Packetization, Routing, Physical Transmission Media, and Reassembly.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-base mb-1">
                  2. Local Installation, Development & Build Instructions
                </h3>
                <pre className="bg-slate-900 text-sky-200 p-4 rounded-xl font-mono text-xs overflow-x-auto">
{`# 1. Install dependencies
npm install react react-dom three lucide-react howler
npm install -D typescript vite @types/react @types/react-dom @types/three @types/howler tailwindcss

# 2. Start Vite development server
npm run dev

# 3. Run TypeScript verification and production build
npm run build
npm run preview`}
                </pre>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-base mb-1">
                  3. Audio & 3D Asset Instructions
                </h3>
                <p>
                  Out of the box, this application uses procedural Three.js low-poly 3D geometry and synthesized Web Audio API sound effects + Web Speech API narration so that it runs with zero external asset 404s. Custom `.mp3`/`.ogg` audio files or `.glb` models can be placed in `public/assets/audio/` and `public/assets/models/` if desired.
                </p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}