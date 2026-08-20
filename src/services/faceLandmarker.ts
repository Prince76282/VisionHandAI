import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

let faceLandmarkerInstance: FaceLandmarker | null = null;
let isFaceLoading = false;
let faceInitPromise: Promise<FaceLandmarker> | null = null;

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_LOCAL = "/models/face_landmarker.task";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerInstance) {
    return faceLandmarkerInstance;
  }

  if (faceInitPromise) {
    return faceInitPromise;
  }

  isFaceLoading = true;
  faceInitPromise = (async () => {
    try {
      console.log("[VisionHand] Initializing MediaPipe Face Landmarker...");
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      // Attempt 1: Local Model with GPU
      try {
        faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_LOCAL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        console.log("[VisionHand] Face Landmarker loaded with GPU.");
        return faceLandmarkerInstance;
      } catch (gpuErr) {
        console.warn("[VisionHand] Face GPU load failed, trying CPU fallback:", gpuErr);
      }

      // Attempt 2: Local Model with CPU
      try {
        faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_LOCAL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        return faceLandmarkerInstance;
      } catch (cpuErr) {
        console.warn("[VisionHand] Face CPU load failed, attempting CDN:", cpuErr);
      }

      // Attempt 3: CDN Model fallback
      faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_CDN,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      return faceLandmarkerInstance;
    } catch (err) {
      console.error("[VisionHand] Fatal: Could not initialize FaceLandmarker:", err);
      faceInitPromise = null;
      throw err;
    } finally {
      isFaceLoading = false;
    }
  })();

  return faceInitPromise;
}

export function isFaceModelLoading(): boolean {
  return isFaceLoading;
}
