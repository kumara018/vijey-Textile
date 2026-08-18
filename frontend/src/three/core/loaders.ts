/**
 * Compressed-asset pipeline: GLTF + Draco + Meshopt + KTX2.
 *
 * An uncompressed GLTF with PNG textures is the single heaviest thing a 3D
 * storefront ships, and the texture half is the part that keeps costing after
 * download: a PNG is decoded to raw RGBA in GPU memory, so a handful of 2K maps
 * can hold more VRAM than the entire mesh set. KTX2 stays compressed *on the
 * GPU*, which is the constraint that actually bites on a 4GB phone.
 *
 * Draco handles geometry, Meshopt handles vertex buffers and animation tracks.
 * They are not alternatives — a well-built asset uses both.
 *
 * Decoders are served from /public rather than a CDN so the site keeps working
 * behind corporate proxies and on flaky mobile connections, and so we are not
 * shipping our customers' traffic to a third party.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';

const DRACO_PATH = '/three/draco/';
const BASIS_PATH = '/three/basis/';

let draco: DRACOLoader | null = null;
let ktx2: KTX2Loader | null = null;

/**
 * Decoder instances are shared across every loader.
 *
 * DRACOLoader spins up a worker pool; creating one per asset would spawn a new
 * pool per model and leave the old ones running.
 */
function getDraco(): DRACOLoader {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    // WASM is several times faster than the JS fallback, and every browser we
    // still render 3D on supports it — the JS decoder is only a safety net.
    draco.setDecoderConfig({ type: 'wasm' });
  }
  return draco;
}

/**
 * KTX2 has to know the GPU's supported compression formats before it can pick a
 * transcode target, which is why this one needs the live renderer.
 */
function getKTX2(renderer: WebGLRenderer): KTX2Loader {
  if (!ktx2) {
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(BASIS_PATH);
  }
  ktx2.detectSupport(renderer);
  return ktx2;
}

/** A GLTFLoader with all three compression extensions attached. */
export function createGLTFLoader(renderer: WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDraco());
  loader.setKTX2Loader(getKTX2(renderer));
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/**
 * Configures Drei's `useGLTF` cache to use the same decoders.
 *
 * Drei keeps its own loader instance, so without this the decoder config above
 * would simply not apply to anything loaded through the hook — the asset would
 * either fail or silently fall back to an uncompressed path.
 */
export function extendDreiLoader(loader: GLTFLoader, renderer: WebGLRenderer): void {
  loader.setDRACOLoader(getDraco());
  loader.setKTX2Loader(getKTX2(renderer));
  loader.setMeshoptDecoder(MeshoptDecoder);
}

/**
 * Releases the decoder worker pools.
 *
 * Only meaningful on a full teardown — the canvas is persistent, so in practice
 * this runs on tab close and exists so a future settings-driven "disable 3D"
 * toggle can genuinely release everything.
 */
export function disposeLoaders(): void {
  draco?.dispose();
  ktx2?.dispose();
  draco = null;
  ktx2 = null;
}
