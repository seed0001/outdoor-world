import {
  Component,
  Suspense,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { playerRef } from "../systems/player/playerRef";
import { AXE_ORIENTATION_RAD } from "../systems/settings/axeOrientation";

/** Static asset: `public/models/axe/axe.glb` */
const AXE_URL = "/models/axe/axe.glb";

/** Right / down / forward in camera local space (Three.js camera −Z is view). */
const HAND_OFFSET = new THREE.Vector3(0.42, -0.34, -0.58);

function ProceduralAxe() {
  return (
    <group>
      <mesh castShadow position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.9, 6]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0.06, 0.12, 0.02]} rotation={[0, 0, Math.PI / 2.2]}>
        <boxGeometry args={[0.38, 0.09, 0.16]} />
        <meshStandardMaterial color="#6b7078" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Simple right-hand grip in front of the axe handle. */
function ProceduralHand() {
  return (
    <group position={[0.02, -0.02, 0.04]} rotation={[0.15, -0.2, 0.08]}>
      <mesh castShadow position={[0, -0.02, 0.02]}>
        <boxGeometry args={[0.1, 0.09, 0.12]} />
        <meshStandardMaterial color="#c49a7c" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0.05, 0.01, 0.04]} rotation={[0.3, 0, 0.4]}>
        <capsuleGeometry args={[0.028, 0.07, 4, 6]} />
        <meshStandardMaterial color="#c49a7c" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[-0.04, 0.02, 0.05]} rotation={[0.2, -0.1, -0.2]}>
        <capsuleGeometry args={[0.022, 0.06, 4, 6]} />
        <meshStandardMaterial color="#c49a7c" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0.03, 0.03, -0.02]} rotation={[0.5, 0.2, 0.1]}>
        <capsuleGeometry args={[0.02, 0.055, 4, 6]} />
        <meshStandardMaterial color="#c49a7c" roughness={0.75} />
      </mesh>
    </group>
  );
}

class AxeLoadErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_e: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.failed) return <ProceduralAxe />;
    return this.props.children;
  }
}

function AxeModel() {
  const { scene } = useGLTF(AXE_URL) as unknown as { scene: THREE.Object3D };

  const root = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const target = 0.55;
    clone.scale.multiplyScalar(target / maxDim);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    const c = b2.getCenter(new THREE.Vector3());
    clone.position.sub(c);
    return clone;
  }, [scene]);

  return <primitive object={root} />;
}

/**
 * First-person axe + hand: world-space group follows the camera each frame
 * (avoids createPortal into a raw THREE.Group, which can fail to render).
 */
export default function HeldAxe() {
  const { camera } = useThree();
  const rigRef = useRef<THREE.Group>(null);
  const swingRef = useRef(0);
  const swingQ = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const offsetWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const rig = rigRef.current;
    if (!rig) return;

    const target = playerRef.axeSwing;
    swingRef.current += (target - swingRef.current) * Math.min(1, dt * 14);
    playerRef.axeSwing = Math.max(0, playerRef.axeSwing - dt * 2.2);
    const s = swingRef.current;

    // s=0 raised; s=1 strike — increase pitch so the blade comes down (top-down chop).
    euler.set(0.38 + s * 1.15, -0.26 - s * 0.2, 0.08);
    swingQ.setFromEuler(euler);

    camera.getWorldQuaternion(rig.quaternion);
    rig.quaternion.multiply(swingQ);

    offsetWorld.copy(HAND_OFFSET).applyQuaternion(camera.quaternion);
    camera.getWorldPosition(worldPos);
    rig.position.copy(worldPos).add(offsetWorld);

    rig.scale.setScalar(1);
  });

  return (
    <group ref={rigRef}>
      <ProceduralHand />
      <group rotation={[0, 0.08, 0]}>
        <group
          rotation={[
            AXE_ORIENTATION_RAD[0],
            AXE_ORIENTATION_RAD[1],
            AXE_ORIENTATION_RAD[2],
          ]}
        >
          {/* 180° on the axe mesh only; chop swing is unchanged on the parent rig. */}
          <group rotation={[0, Math.PI, 0]}>
            <Suspense fallback={<ProceduralAxe />}>
              <AxeLoadErrorBoundary>
                <AxeModel />
              </AxeLoadErrorBoundary>
            </Suspense>
          </group>
        </group>
      </group>
    </group>
  );
}
