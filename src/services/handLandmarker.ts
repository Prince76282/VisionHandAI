import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

let landmarkerInstance: HandLandmarker | null = null;
let isLoading = false;
let initPromise: Promise<HandLandmarker> | null = null;

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_LOCAL = "/models/hand_landmarker.task";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface LandmarkerConfig {
  numHands?: number;
  minDetectionConfidence?: number;
  minPresenceConfidence?: number;
  minTrackingConfidence?: number;
}

export async function getHandLandmarker(config: LandmarkerConfig = {}): Promise<HandLandmarker> {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  isLoading = true;
  initPromise = (async () => {
    try {
      console.log("[VisionHand] Initializing MediaPipe WASM FilesetResolver...");
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      // Attempt 1: Local Model with GPU delegate
      try {
        console.log("[VisionHand] Loading local hand landmarker model (GPU)...");
        landmarkerInstance = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_LOCAL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: config.numHands ?? 2,
          minHandDetectionConfidence: config.minDetectionConfidence ?? 0.5,
          minHandPresenceConfidence: config.minPresenceConfidence ?? 0.5,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        });
        console.log("[VisionHand] Hand Landmarker successfully initialized with GPU.");
        return landmarkerInstance;
      } catch (localGpuErr) {
        console.warn("[VisionHand] GPU / Local load failed, falling back to CPU or CDN:", localGpuErr);
      }

      // Attempt 2: Local Model with CPU delegate
      try {
        console.log("[VisionHand] Attempting CPU delegate...");
        landmarkerInstance = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_LOCAL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: config.numHands ?? 2,
          minHandDetectionConfidence: config.minDetectionConfidence ?? 0.5,
          minHandPresenceConfidence: config.minPresenceConfidence ?? 0.5,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        });
        return landmarkerInstance;
      } catch (localCpuErr) {
        console.warn("[VisionHand] Local CPU load failed, attempting CDN model...", localCpuErr);
      }

      // Attempt 3: CDN Model fallback
      landmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_CDN,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: config.numHands ?? 2,
        minHandDetectionConfidence: config.minDetectionConfidence ?? 0.5,
        minHandPresenceConfidence: config.minPresenceConfidence ?? 0.5,
        minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
      });

      return landmarkerInstance;
    } catch (err) {
      console.error("[VisionHand] Fatal: Could not initialize HandLandmarker:", err);
      initPromise = null;
      throw err;
    } finally {
      isLoading = false;
    }
  })();

  return initPromise;
}

export function isModelLoading(): boolean {
  return isLoading;
}

export function isModelReady(): boolean {
  return landmarkerInstance !== null;
}
