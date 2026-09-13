import { Suspense, useRef, useEffect, useState, Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── React Error Boundary ─────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean }
interface ErrorBoundaryProps { children: ReactNode; fallback: ReactNode }

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* Silently swallow */ }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Component Identification & Data ──────────────────────────────────────────
export interface ComponentDetail {
  id: string;
  name: string;
  category: string;
  spec?: string;
  description?: string;
}

export function identifyComponent(obj: THREE.Object3D | null): ComponentDetail | null {
  let curr: THREE.Object3D | null = obj;
  let isDisplayCase = false;
  let isMesh = false;

  while (curr) {
    const raw = `${curr.name || ''} ${(curr as any).geometry?.name || ''} ${curr.userData?.name || ''}`.toLowerCase();

    // 1. Explicitly ignore Display Case (no highlight, no details)
    if (raw.includes('display case')) {
      isDisplayCase = true;
      return null;
    }

    // 2. Core Hardware Modules
    if (raw.includes('camera')) {
      return {
        id: 'camera',
        name: 'GC2145 2MP Camera Module',
        category: 'Vision / DVP',
        spec: '2MP · ~80° FOV · Parallel DVP Bus',
      };
    }
    if (raw.includes('esp32')) {
      return {
        id: 'esp32',
        name: 'ESP32-S3-WROOM-1 N16R8',
        category: 'Dual-Core AI MCU',
        spec: '240MHz · 16MB Flash · 8MB PSRAM · Wi-Fi/BT5',
      };
    }
    if (raw.includes('display')) {
      return {
        id: 'display',
        name: '2.8" Color LCD (ILI9341)',
        category: 'Display / SPI',
        spec: '240×320 · High-Speed SPI · MMBT3904T BLK',
      };
    }
    if (raw.includes('a button') || raw.includes('button a')) {
      return {
        id: 'btn_a',
        name: 'User Button A (P5/KeyA)',
        category: 'Input',
        spec: 'XL9535 Expander / Micro:bit P5',
      };
    }
    if (raw.includes('b button') || raw.includes('button b')) {
      return {
        id: 'btn_b',
        name: 'User Button B (P11/KeyB)',
        category: 'Input',
        spec: 'XL9535 Expander / Micro:bit P11',
      };
    }
    if (raw.includes('rst') || raw.includes('reset')) {
      return {
        id: 'btn_rst',
        name: 'Hardware Reset Button',
        category: 'Control',
        spec: 'ESP32-S3 Hard Reset (CHIP_PU)',
      };
    }
    if (raw.includes('boot')) {
      return {
        id: 'btn_boot',
        name: 'Bootloader Mode Button',
        category: 'Control',
        spec: 'GPIO0 ROM Download Mode',
      };
    }
    if (raw.includes('speaker')) {
      return {
        id: 'speaker',
        name: 'NS4168 Amp + 2W Speaker',
        category: 'Audio / I²S',
        spec: 'Class-D Amplifier · Digital I²S Audio',
      };
    }
    if (raw.includes('rgb')) {
      return {
        id: 'rgb',
        name: '3× WS2812 Smart RGB LEDs',
        category: 'Indicator',
        spec: 'Addressable Daisy-Chain · 24-bit True Color',
      };
    }
    if (raw.includes('type-c') || raw.includes('type_c') || raw.includes('usb')) {
      return {
        id: 'type_c',
        name: 'USB Type-C Interface',
        category: 'Power & Data',
        spec: '5V DC · Native USB_P/USB_N · TVS Protection',
      };
    }
    if (raw.includes('dual mic') || raw.includes('mic')) {
      return {
        id: 'mic',
        name: '2× MEMS Microphones',
        category: 'Audio Capture',
        spec: 'ES7243E 24-bit Audio ADC · I²S Bus',
      };
    }
    if (raw.includes('light sensor') || raw.includes('light')) {
      return {
        id: 'light',
        name: 'LTR-303ALS Ambient Light',
        category: 'Sensor / I²C',
        spec: 'I²C 0x29 · 0–64,000 Lux Range',
      };
    }
    if (raw.includes('edge connector') || raw.includes('edge')) {
      return {
        id: 'edge',
        name: 'Micro:bit Edge Connector',
        category: 'Expansion Bus',
        spec: '15× Digital I/O · P0–P16, P19, P20, 3V3, GND',
      };
    }
    if (raw.includes('imu')) {
      return {
        id: 'imu',
        name: 'SC7A20H 3-Axis Accelerometer',
        category: 'Motion Sensor',
        spec: 'I²C 0x19 · ±2G/±4G/±8G/±16G Range',
      };
    }
    if (raw.includes('env')) {
      return {
        id: 'env',
        name: 'AHT20 Temp & Humidity',
        category: 'Sensor / I²C',
        spec: 'I²C 0x38 · ±0.3°C · ±2% RH Range',
      };
    }
    if (raw.includes('sd card') || raw.includes('sd')) {
      return {
        id: 'sd',
        name: 'Self-Ejecting MicroSD Slot',
        category: 'Storage / SPI',
        spec: 'High-Speed SPI Bus · Up to 32GB',
      };
    }
    if (raw.includes('battery')) {
      return {
        id: 'battery',
        name: 'PH2.0 2-Pin Battery Socket',
        category: 'Power Supply',
        spec: '3.0–6.5V Range (3.7V LiPo / 3×AA)',
      };
    }
    if (raw.includes('i2c')) {
      return {
        id: 'i2c',
        name: 'Gravity I²C Interface',
        category: 'Peripheral Port',
        spec: 'P19 (SCL) · P20 (SDA) · 3.3V Power',
      };
    }
    if (raw.includes('io1') || raw.includes('io 1')) {
      return {
        id: 'io1',
        name: 'Gravity IO1 Interface (P0)',
        category: 'Peripheral Port',
        spec: 'Digital / ADC / PWM Channel',
      };
    }
    if (raw.includes('io2') || raw.includes('io 2')) {
      return {
        id: 'io2',
        name: 'Gravity IO2 Interface (P1)',
        category: 'Peripheral Port',
        spec: 'Digital / ADC / PWM Channel',
      };
    }

    if ((curr as any).isMesh) {
      isMesh = true;
    }

    curr = curr.parent;
  }

  // 3. All other components on the board fall under Core PCB
  if (!isDisplayCase && (isMesh || obj)) {
    return {
      id: 'pcb',
      name: 'Core PCB & Subsystems',
      category: 'Circuitry',
      spec: 'XL9535 Expander · BL8555 / AP7343Q LDOs',
    };
  }

  return null;
}

// ─── 3D Callout Line & Annotation ─────────────────────────────────────────────
function ComponentCallout({
  comp,
  position,
}: {
  comp: ComponentDetail;
  position: THREE.Vector3;
}) {
  const isRight = position.x >= 0;

  return (
    <Html
      position={[position.x, position.y, position.z]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      zIndexRange={[100, 0]}
    >
      <div className={`k10-callout ${isRight ? 'k10-callout--right' : 'k10-callout--left'}`}>
        {/* Glowing target point on the 3D component */}
        <div className="k10-callout__target">
          <span className="k10-callout__target-ring" />
          <span className="k10-callout__target-dot" />
        </div>

        {/* Dynamic technical leader line */}
        <svg
          className="k10-callout__svg"
          width="90"
          height="60"
          viewBox="0 0 90 60"
        >
          {isRight ? (
            <>
              <polyline
                points="0,60 35,20 85,20"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <circle cx="85" cy="20" r="2.5" fill="var(--color-accent)" />
            </>
          ) : (
            <>
              <polyline
                points="90,60 55,20 5,20"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <circle cx="5" cy="20" r="2.5" fill="var(--color-accent)" />
            </>
          )}
        </svg>

        {/* Floating component detail card */}
        <div className="k10-callout__card">
          <div className="k10-callout__category">{comp.category}</div>
          <div className="k10-callout__title">{comp.name}</div>
          {comp.spec && <div className="k10-callout__spec">{comp.spec}</div>}
        </div>
      </div>
    </Html>
  );
}

// ─── K10 GLB Loader with Unified Component Grouping ───────────────────────────
function K10GLBModel({
  url,
  onHover,
}: {
  url: string;
  onHover: (comp: ComponentDetail | null, point: THREE.Vector3 | null) => void;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const compMeshesMapRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const currentlyHighlightedId = useRef<string | null>(null);

  const [transform, setTransform] = useState<{ scale: number; position: [number, number, number] }>({
    scale: 1,
    position: [0, 0, 0],
  });

  useEffect(() => {
    if (!scene) return;

    // 1. Ensure pristine unscaled/unmoved state so measurement is always 100% idempotent
    scene.scale.set(1, 1, 1);
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.updateMatrixWorld(true);

    const meshMap = new Map<string, THREE.Mesh[]>();

    // Enable shadows and component identification
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material && !mesh.userData.hasClonedMaterial) {
          mesh.material = (mesh.material as THREE.Material).clone();
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.envMapIntensity = 0.3;
          mat.needsUpdate = true;
          mesh.userData.hasClonedMaterial = true;
          mesh.userData.origEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0, 0, 0);
          mesh.userData.origIntensity = mat.emissiveIntensity || 0;
        }

        const comp = identifyComponent(mesh);
        if (comp) {
          mesh.userData.componentId = comp.id;
          if (!meshMap.has(comp.id)) meshMap.set(comp.id, []);
          meshMap.get(comp.id)!.push(mesh);
        }
      }
    });

    compMeshesMapRef.current = meshMap;

    // 2. Compute exact bounding box of the uncorrupted model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      // Scale model by +20% (from 2.2 to 2.64) to provide a larger, more immersive 3D hero visualization
      const scale = 2.64 / maxDim;
      setTransform({
        scale,
        position: [-center.x * scale, -center.y * scale, -center.z * scale],
      });
    }

    return () => {
      clearHighlight();
      document.body.style.cursor = 'auto';
    };
  }, [scene]);

  const clearHighlight = () => {
    if (currentlyHighlightedId.current) {
      const meshes = compMeshesMapRef.current.get(currentlyHighlightedId.current) || [];
      meshes.forEach((m) => {
        if ((m.material as any)?.emissive && m.userData.origEmissive) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.copy(m.userData.origEmissive);
          mat.emissiveIntensity = m.userData.origIntensity;
        }
      });
      currentlyHighlightedId.current = null;
    }
    document.body.style.cursor = 'auto';
  };

  const setHighlightGroup = (compId: string) => {
    if (currentlyHighlightedId.current === compId) return;
    clearHighlight();
    currentlyHighlightedId.current = compId;
    const meshes = compMeshesMapRef.current.get(compId) || [];
    meshes.forEach((m) => {
      if ((m.material as any)?.emissive) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(0x1d4ed8);
        mat.emissiveIntensity = 0.55;
      }
    });
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    const hitObject = (e.intersections?.[0]?.object || e.object) as THREE.Mesh;
    if (!hitObject) return;

    const comp = identifyComponent(hitObject);
    if (comp) {
      // Exact 3D intersection point directly underneath the cursor
      const cursorPoint =
        e.intersections?.[0]?.point?.clone() ||
        e.point?.clone() ||
        hitObject.getWorldPosition(new THREE.Vector3());

      setHighlightGroup(comp.id);
      onHover(comp, cursorPoint);
    } else {
      clearHighlight();
      onHover(null, null);
    }
  };

  const handlePointerOut = (e: any) => {
    if (!e.intersections || e.intersections.length === 0) {
      clearHighlight();
      onHover(null, null);
    }
  };

  return (
    <group
      ref={groupRef}
      position={transform.position}
      scale={transform.scale}
      onPointerOver={handlePointerOver}
      onPointerMove={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={scene} />
    </group>
  );
}

// ─── Loading Indicator ────────────────────────────────────────────────────────
function ModelLoading() {
  return (
    <Html center>
      <div className="model-loading">
        <div className="model-loading__spinner" />
        <span className="model-loading__text">Loading K10 model...</span>
      </div>
    </Html>
  );
}

// ─── 3D Canvas Scene ─────────────────────────────────────────────────────────
function K10Scene({
  modelUrl,
  hoveredComp,
  activeCallout,
  onHover,
}: {
  modelUrl: string;
  hoveredComp: ComponentDetail | null;
  activeCallout: { comp: ComponentDetail; point: THREE.Vector3 } | null;
  onHover: (comp: ComponentDetail | null, point: THREE.Vector3 | null) => void;
}) {
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      className="hero__model-canvas"
      camera={{ position: [0, 0, 4.6], fov: 42 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      shadows
      style={{ background: 'transparent' }}
      aria-label="Interactive 3D model of the UNIHIKER K10"
      onPointerMissed={() => onHover(null, null)}
    >
      {/* Neutral crisp white lighting */}
      <ambientLight intensity={0.95} color="#FFFFFF" />
      <directionalLight position={[5, 9, 6]} intensity={1.5} color="#FFFFFF" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 4, 4]} intensity={0.8} color="#F8FAFC" />
      <directionalLight position={[0, -4, 3]} intensity={0.4} color="#FFFFFF" />
      <Environment preset="studio" />

      <Suspense fallback={<ModelLoading />}>
        <K10GLBModel url={modelUrl} onHover={onHover} />
      </Suspense>

      {/* 3D Callout Line & Detail Card */}
      {activeCallout && (
        <ComponentCallout comp={activeCallout.comp} position={activeCallout.point} />
      )}

      <ContactShadows position={[0, -1.48, 0]} opacity={0.25} scale={7.2} blur={2.2} far={3.5} color="#1C1917" />

      {/* OrbitControls: autoRotate stops smoothly on hover without camera zoom */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate={!hoveredComp}
        autoRotateSpeed={0.8}
        makeDefault
      />
    </Canvas>
  );
}

// ─── Image Fallback ───────────────────────────────────────────────────────────
function ImageFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        backgroundColor: 'var(--color-paper-warm)',
      }}
    >
      <img
        src="/images/Hero.png"
        alt="UNIHIKER K10 — front and back hardware view"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(242, 239, 232, 0.35) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ─── Main K10Model Component ──────────────────────────────────────────────────
interface K10ModelProps {
  glbUrl?: string;
}

export default function K10Model({ glbUrl }: K10ModelProps) {
  const [glbExists, setGlbExists] = useState<boolean | null>(null); // null = checking
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const [hoveredComp, setHoveredComp] = useState<ComponentDetail | null>(null);
  const [activeCallout, setActiveCallout] = useState<{ comp: ComponentDetail; point: THREE.Vector3 } | null>(null);
  const lastPointRef = useRef<THREE.Vector3 | null>(null);

  const handleHover = (comp: ComponentDetail | null, point: THREE.Vector3 | null) => {
    if (!comp || !point) {
      setHoveredComp(null);
      setActiveCallout(null);
      lastPointRef.current = null;
      return;
    }

    if (comp.id !== hoveredComp?.id) {
      setHoveredComp(comp);
    }

    // Smoothly track cursor location on the 3D surface
    if (
      !lastPointRef.current ||
      comp.id !== activeCallout?.comp.id ||
      lastPointRef.current.distanceTo(point) > 0.03
    ) {
      lastPointRef.current = point.clone();
      setActiveCallout({ comp, point });
    }
  };

  // Check WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setWebGLAvailable(false);
    } catch {
      setWebGLAvailable(false);
    }
  }, []);

  // Probe for GLB file existence before attempting to load via Three.js
  useEffect(() => {
    if (!glbUrl) { setGlbExists(false); return; }
    fetch(glbUrl, { method: 'HEAD' })
      .then((r) => setGlbExists(r.ok))
      .catch(() => setGlbExists(false));
  }, [glbUrl]);

  // Still probing
  if (glbExists === null) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'transparent', borderRadius: 'var(--radius-lg)',
      }}>
        <div className="model-loading">
          <div className="model-loading__spinner" />
          <span className="model-loading__text">Initializing...</span>
        </div>
      </div>
    );
  }

  // No GLB or no WebGL — use high-quality image
  if (!glbExists || !webGLAvailable || !glbUrl) {
    return <ImageFallback />;
  }

  // Render 3D scene (clean view — dynamic callout only appears on hover)
  return (
    <div className="k10-model-wrapper">
      <ModelErrorBoundary fallback={<ImageFallback />}>
        <K10Scene
          modelUrl={glbUrl}
          hoveredComp={hoveredComp}
          activeCallout={activeCallout}
          onHover={handleHover}
        />
      </ModelErrorBoundary>
    </div>
  );
}
