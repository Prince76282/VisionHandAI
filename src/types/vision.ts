export type GestureType =
  | "OPEN_PALM"
  | "FIST"
  | "THUMBS_UP"
  | "THUMBS_DOWN"
  | "PEACE_SIGN"
  | "PINCH"
  | "POINT"
  | "OK_SIGN"
  | "NONE";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandednessInfo {
  index: number;
  score: number;
  categoryName: "Left" | "Right" | string;
  displayName: string;
}

export interface GestureEvent {
  timestamp: number;
  source: "hand";
  hand: "left" | "right";
  event: GestureType;
  confidence: number;
  position: [number, number]; // [x, y] normalized coordinates (0.0 to 1.0)
  rawLandmarks?: NormalizedLandmark[];
}

export interface HandData {
  landmarks: NormalizedLandmark[];
  handedness: "left" | "right";
  score: number;
  currentGesture: GestureEvent;
}

export interface FaceData {
  landmarks: NormalizedLandmark[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  estimatedAge: string;
  ageConfidence: number;
  emotion: string;
  emotionScore: number;
  symmetry: number;
  headPose: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  eyesBlinking: {
    left: boolean;
    right: boolean;
  };
}

export interface VisionFrameData {
  timestamp: number;
  fps: number;
  inferenceTimeMs: number;
  hands: HandData[];
  handCount: number;
  faces: FaceData[];
  faceCount: number;
}

export type AppMode = "live" | "air_draw" | "object_scan" | "games";
export type GameType = "balloon_pop" | "rock_paper_scissors" | "laser_slice" | "car_drive";

export interface DetectedObject {
  label: string;
  confidence: number;
  description: string;
  category?: string;
}

export interface ObjectDetectionResult {
  objects: DetectedObject[];
  rawText: string;
  model: string;
  timestamp: number;
  imageSource: "webcam" | "upload";
}
