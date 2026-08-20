import React, { useRef, useEffect, useState, useCallback } from "react";
import { HandLandmarker, FaceLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "../services/handLandmarker";
import { getFaceLandmarker } from "../services/faceLandmarker";
import { defaultGestureRecognizer } from "../services/gestureRecognizer";
import { analyzeFace } from "../services/faceAnalysis";
import { gestureBus } from "../services/eventBus";
import { drawVisionOverlays } from "../utils/drawingUtils";
import type { DrawOptions } from "../utils/drawingUtils";
import type { HandData, FaceData, VisionFrameData } from "../types/vision";
import {
  Camera,
  CameraOff,
  Video,
  Activity,
  AlertCircle,
  Eye,
  Settings2,
  RefreshCw,
  Layers,
  Smile,
  Maximize,
  Minimize
} from "lucide-react";

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  onToggleCamera: () => void;
  onFrameUpdate?: (frame: VisionFrameData) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  isActive,
  isLoading,
  error,
  onToggleCamera,
  onFrameUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Performance telemetry
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const fpsFrameCountRef = useRef<number>(0);
  const fpsLastTimestampRef = useRef<number>(performance.now());

  // Model loading state
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [modelStatus, setModelStatus] = useState<string>("Loading MediaPipe AI Models...");
  const [modelError, setModelError] = useState<string | null>(null);

  // Vision detection states
  const [detectedHands, setDetectedHands] = useState<HandData[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<FaceData[]>([]);
  const [noSubjectDetected, setNoSubjectDetected] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Overlay settings
  const [drawOptions, setDrawOptions] = useState<DrawOptions>({
    mirrored: true,
    showSkeleton: true,
    showLandmarks: true,
    showHandedness: true,
    showGestureBadge: true,
    showBoundingBox: true,
    activeFingerHighlight: true,
    showFaceMesh: true,
    showFaceHUD: true,
    showAgeEmotion: true,
  });

  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Initialize both Hand & Face Landmarkers concurrently
  useEffect(() => {
    let isMounted = true;
    setIsModelLoading(true);
    setModelStatus("Initializing Hand & Face Neural Models...");

    Promise.all([getHandLandmarker(), getFaceLandmarker()])
      .then(([handLandmarker, faceLandmarker]) => {
        if (isMounted) {
          handLandmarkerRef.current = handLandmarker;
          faceLandmarkerRef.current = faceLandmarker;
          setIsModelLoading(false);
          console.log("[CameraView] Both Hand & Face Landmarkers initialized.");
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("[CameraView] Model init error:", err);
          setModelError("Failed to initialize Vision models: " + err.message);
          setIsModelLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Main Detection Loop: runs both Hand Landmarker & Face Landmarker on each frame
  const processVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const handLandmarker = handLandmarkerRef.current;
    const faceLandmarker = faceLandmarkerRef.current;

    if (
      !video ||
      !canvas ||
      !handLandmarker ||
      !isActive ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      if (isActive) {
        animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const startTime = performance.now();

      try {
        // 1. Run Hand Landmarker
        const handResults = handLandmarker.detectForVideo(video, startTime);
        
        // 2. Run Face Landmarker if available
        let faceResults = null;
        if (faceLandmarker) {
          try {
            faceResults = faceLandmarker.detectForVideo(video, startTime);
          } catch (e) {
            // Face frame skip fallback
          }
        }

        const inferenceTime = performance.now() - startTime;
        setLatencyMs(Math.round(inferenceTime));

        // Process Hands Data
        const handsData: HandData[] = [];
        if (handResults.landmarks && handResults.landmarks.length > 0) {
          for (let i = 0; i < handResults.landmarks.length; i++) {
            const rawLandmarks = handResults.landmarks[i];
            const handednessInfo = handResults.handednesses?.[i]?.[0];
            const categoryName = handednessInfo?.categoryName || (i === 0 ? "Right" : "Left");
            const rawHand: "left" | "right" = categoryName.toLowerCase().includes("left") ? "left" : "right";

            const handSide: "left" | "right" = drawOptions.mirrored
              ? rawHand === "left" ? "right" : "left"
              : rawHand;

            const score = handednessInfo?.score ?? 0.9;
            const gestureEvent = defaultGestureRecognizer.recognize(rawLandmarks, handSide, startTime);

            gestureBus.emit(gestureEvent);

            handsData.push({
              landmarks: rawLandmarks,
              handedness: handSide,
              score,
              currentGesture: gestureEvent,
            });
          }
          setDetectedHands(handsData);
        } else {
          setDetectedHands([]);
          gestureBus.clear();
        }

        // Process Face Data
        const facesData: FaceData[] = [];
        if (faceResults && faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
          for (const faceMesh of faceResults.faceLandmarks) {
            const analyzed = analyzeFace(faceMesh);
            if (analyzed) {
              facesData.push(analyzed);
            }
          }
          setDetectedFaces(facesData);
        } else {
          setDetectedFaces([]);
        }

        const hasSubject = handsData.length > 0 || facesData.length > 0;
        setNoSubjectDetected(!hasSubject);

        // Clear canvas and draw rich overlays
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawVisionOverlays(ctx, handsData, facesData, canvas.width, canvas.height, drawOptions);

        if (onFrameUpdate) {
          onFrameUpdate({
            timestamp: startTime,
            fps,
            inferenceTimeMs: inferenceTime,
            hands: handsData,
            handCount: handsData.length,
            faces: facesData,
            faceCount: facesData.length,
          });
        }
      } catch (err) {
        console.error("[CameraView] Processing error:", err);
      }

      fpsFrameCountRef.current++;
      const now = performance.now();
      if (now - fpsLastTimestampRef.current >= 1000) {
        setFps(fpsFrameCountRef.current);
        fpsFrameCountRef.current = 0;
        fpsLastTimestampRef.current = now;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
  }, [isActive, drawOptions, fps, onFrameUpdate, videoRef]);

  useEffect(() => {
    if (isActive) {
      animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      setDetectedHands([]);
      setDetectedFaces([]);
      setNoSubjectDetected(true);
      setFps(0);
      setLatencyMs(0);
      gestureBus.clear();

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isActive, processVideoFrame]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col items-center justify-between">
      {/* Top HUD Camera Control Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border z-20 shadow-lg">
        {/* Left: Camera Switcher & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCamera}
            disabled={isLoading || isModelLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
              isActive
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isActive ? (
              <CameraOff className="w-3.5 h-3.5" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{isActive ? "Turn Off Camera" : "Turn On Camera"}</span>
          </button>

          {/* Active Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isActive ? "bg-emerald-400 shadow-[0_0_10px_#4ade80] animate-pulse" : "bg-slate-600"
              }`}
            />
            <span className={isActive ? "text-emerald-400 font-semibold" : "text-slate-500"}>
              {isActive ? "LIVE MULTI-MODAL VISION" : "STANDBY"}
            </span>
          </div>
        </div>

        {/* Right: Telemetry & Overlay Drawer */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{fps} FPS</span>
          </div>

          <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300">
            <span>{latencyMs}ms</span>
          </div>

          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`p-1.5 rounded-lg border transition-all ${
              showSettings ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Overlay Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Settings Dropdown Drawer */}
      {showSettings && (
        <div className="w-full mt-2 p-3.5 bg-cyber-card/95 backdrop-blur-md rounded-xl border border-cyber-border z-30 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={drawOptions.showSkeleton}
              onChange={(e) => setDrawOptions((o) => ({ ...o, showSkeleton: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span>Hand 21-Point Skeleton</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={drawOptions.showFaceMesh}
              onChange={(e) => setDrawOptions((o) => ({ ...o, showFaceMesh: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span>Face Mesh Wireframe</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={drawOptions.showAgeEmotion}
              onChange={(e) => setDrawOptions((o) => ({ ...o, showAgeEmotion: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span>Age & Emotion HUD</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={drawOptions.mirrored}
              onChange={(e) => setDrawOptions((o) => ({ ...o, mirrored: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span>Mirror Webcam Feed</span>
          </label>
        </div>
      )}

      {/* Main Video + Canvas Stage */}
      <div
        className={`relative w-full flex-1 my-3 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center transition-all ${
          isActive ? "neon-border-cyan border-2" : "border border-slate-800"
        }`}
      >
        <video
          ref={videoRef as any}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isActive ? "opacity-100" : "opacity-0"
          } ${drawOptions.mirrored ? "-scale-x-100" : ""}`}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />

        {/* Camera Inactive Standby Screen */}
        {!isActive && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-gradient-to-b from-slate-950/80 to-slate-900/90">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4 shadow-glow">
              <Video className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Webcam Inactive</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-5">
              Activate your camera to run real-time Hand Tracking, Face Recognition, Age & Emotion analysis 100% client-side.
            </p>
            <button
              onClick={onToggleCamera}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm tracking-wider uppercase flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Activate Webcam</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {(isLoading || isModelLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm z-20">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-xs font-mono text-cyan-300">{modelStatus}</p>
          </div>
        )}

        {/* Error Alert */}
        {(error || modelError) && (
          <div className="absolute top-4 left-4 right-4 bg-red-950/90 border border-red-800 text-red-200 p-3 rounded-xl text-xs flex items-center gap-3 z-30 shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <div className="flex-1">{error || modelError}</div>
          </div>
        )}

        {/* Scanning for Subject HUD */}
        {isActive && noSubjectDetected && (
          <div className="absolute bottom-6 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs font-mono shadow-xl z-20 animate-pulse">
            <Eye className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Scanning for Hands & Faces... Show your face and hands to camera</span>
          </div>
        )}

        {/* Live Subject Detection Count Badges */}
        {isActive && !noSubjectDetected && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
            {detectedHands.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-md">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>{detectedHands.length} {detectedHands.length === 1 ? "Hand" : "Hands"}</span>
              </div>
            )}

            {detectedFaces.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-pink-500/30 text-xs font-mono text-pink-300 shadow-md">
                <Smile className="w-3.5 h-3.5 text-pink-400" />
                <span>Face Locked ({detectedFaces[0].estimatedAge})</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
