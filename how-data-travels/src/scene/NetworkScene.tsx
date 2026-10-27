import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

type V3 = [number, number, number];
export const NODES = {
  sender: [-6, 0, 0], router: [-2.5, 0, 0], n1: [0.5, 1.6, -1.6],
  n2: [0.5, 0, 1.8], n3: [3, 0.8, 0], receiver: [6, 0, 0]
} as const satisfies Record<string, V3>;
type NodeId = keyof typeof NODES;

const EDGES: [NodeId, NodeId, string][] = [
  ['sender', 'router', '#22d3ee'], ['router', 'n1', '#a78bfa'], ['router', 'n2', '#fb923c'],
  ['n1', 'n3', '#a78bfa'], ['n2', 'n3', '#fb923c'], ['n3', 'receiver', '#22d3ee']
];

import { PACKETS } from './packets';
const BASE_DURATION = 6; // seconds for a speed-1 packet to cross the whole path

export interface SceneProps {
  playing: boolean; speed: number; replayKey: number; follow: boolean; altRoutes: boolean;
  onArrive: (order: number[]) => void;
}

function Computer({ position, color, label }: { position: V3; color: string; label: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[1.8, 1.2, 0.18]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      <mesh position={[0, 0.9, 0.1]}><boxGeometry args={[1.55, 0.95, 0.02]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} /></mesh>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.25, 0.5, 0.2]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      <mesh position={[0, -0.05, 0.1]} castShadow><boxGeometry args={[1.1, 0.1, 0.8]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      <Html position={[0, 2, 0]} center className="tag">{label}</Html>
    </group>
  );
}

function Router({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.15, 0]}><boxGeometry args={[1.6, 0.3, 1]} /><meshStandardMaterial color="#fb923c" /></mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.65, -0.3]}><cylinderGeometry args={[0.04, 0.04, 0.7, 8]} /><meshStandardMaterial color="#334155" /></mesh>
      ))}
      <Html position={[0, 1.3, 0]} center className="tag">Router</Html>
    </group>
  );
}

function NetNode({ position, label }: { position: V3; label: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.4; });
  return (
    <group position={position}>
      <mesh ref={ref} castShadow><octahedronGeometry args={[0.5]} /><meshStandardMaterial color="#a78bfa" flatShading /></mesh>
      <Html position={[0, 0.95, 0]} center className="tag">{label}</Html>
    </group>
  );
}

function Packets({ playing, speed, replayKey, follow, altRoutes, onArrive }: SceneProps) {
  const time = useRef(0);
  const arrived = useRef<number[]>([]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const camTarget = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const paths = useMemo(() => PACKETS.map((p) => {
    const ids: NodeId[] = ['sender', 'router', altRoutes ? p.via : 'n1', 'n3', 'receiver'];
    const pts = ids.map((n) => new THREE.Vector3(...NODES[n]).add(new THREE.Vector3(0, 0.45, 0)));
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    return path;
  }), [altRoutes]);

  useEffect(() => { time.current = 0; arrived.current = []; onArrive([]); }, [replayKey, altRoutes, onArrive]);

  useFrame((state, dt) => {
    if (playing) time.current += Math.min(dt, 0.05) * speed;
    PACKETS.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      const u = THREE.MathUtils.clamp((time.current - p.delay) / (BASE_DURATION / (altRoutes ? p.speed : 1)), 0, 1);
      g.visible = u > 0 && u < 1;
      g.position.copy(paths[i].getPointAt(u));
      g.rotation.y += dt * 2;
      if (u >= 1 && !arrived.current.includes(p.id)) { arrived.current = [...arrived.current, p.id]; onArrive(arrived.current); }
    });
    if (follow) {
      const g = groups.current[0];
      if (g) {
        camTarget.current.lerp(g.position, 0.08);
        camPos.current.set(g.position.x, g.position.y + 2.2, g.position.z + 6);
        state.camera.position.lerp(camPos.current, 0.05);
        state.camera.lookAt(camTarget.current);
      }
    }
  });

  return (
    <>
      {PACKETS.map((p, i) => (
        <group key={p.id} ref={(el) => { groups.current[i] = el; }} visible={false}>
          <mesh castShadow><boxGeometry args={[0.55, 0.4, 0.4]} /><meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.6} /></mesh>
          <Html center distanceFactor={9} zIndexRange={[5, 0]}><div className="pk" style={{ background: p.color }}>{p.id}</div></Html>
        </group>
      ))}
    </>
  );
}

function CameraRig({ follow }: { follow: boolean }) {
  const ref = useRef<OrbitControlsImpl>(null);
  useEffect(() => { if (!follow && ref.current) ref.current.target.set(0, 0.6, 0); }, [follow]);
  return <OrbitControls ref={ref} enabled={!follow} enablePan={false} minDistance={6} maxDistance={22} maxPolarAngle={Math.PI / 2.1} />;
}

export default function NetworkScene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 6, 13], fov: 45 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow />
      {EDGES.map(([a, b, c]) => (
        <Line key={a + b} points={[NODES[a] as V3, NODES[b] as V3]} color={c} lineWidth={3} />
      ))}
      <Computer position={NODES.sender as unknown as V3} color="#38bdf8" label="Sender" />
      <Router position={NODES.router as unknown as V3} />
      <NetNode position={NODES.n1 as unknown as V3} label="Node A" />
      <NetNode position={NODES.n2 as unknown as V3} label="Node B" />
      <NetNode position={NODES.n3 as unknown as V3} label="Node C" />
      <Computer position={NODES.receiver as unknown as V3} color="#4ade80" label="Receiver" />
      <Packets {...props} />
      <ContactShadows position={[0, -0.6, 0]} opacity={0.25} scale={24} blur={2.5} far={4} />
      <CameraRig follow={props.follow} />
    </Canvas>
  );
}
