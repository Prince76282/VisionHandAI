import React, { useState } from "react";
import { useGestureEvents } from "../hooks/useGestureEvents";
import type { VisionFrameData } from "../types/vision";
import { Code, Hand, UserCheck } from "lucide-react";

interface StatsOverlayProps {
  frameData?: VisionFrameData | null;
}

const GESTURE_ICONS: Record<string, string> = {
  OPEN_PALM: "✋",
  FIST: "✊",
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
  PEACE_SIGN: "✌️",
  PINCH: "🤏",
  POINT: "👉",
  OK_SIGN: "👌",
  NONE: "⏳",
};

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ frameData }) => {
  const { latestEvent, activeHands } = useGestureEvents();
  const [showJsonRaw, setShowJsonRaw] = useState<boolean>(false);

  const leftHand = activeHands.left;
  const rightHand = activeHands.right;
  const face = frameData?.faces?.[0];

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Face Recognition & Age Telemetry Card */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          face
            ? "bg-slate-900/95 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
            : "bg-slate-950/60 border-slate-800 opacity-70"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-cyan-400" /> Facial Biometrics & Age
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
            {face ? `${Math.round(face.ageConfidence * 100)}% Conf` : "Scanning"}
          </span>
        </div>

        {face ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Estimated Age</span>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">{face.estimatedAge}</div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Expression / Mood</span>
              <div className="text-sm font-bold text-pink-300 mt-0.5">{face.emotion}</div>
            </div>

            <div className="col-span-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span>Symmetry: <strong className="text-emerald-400">{Math.round(face.symmetry * 100)}%</strong></span>
              <span>Pose: <strong className="text-cyan-400">{face.headPose.yaw}°</strong></span>
              <span>Eyes: <strong className={face.eyesBlinking.left || face.eyesBlinking.right ? "text-pink-400" : "text-slate-400"}>
                {face.eyesBlinking.left && face.eyesBlinking.right ? "Blinking" : face.eyesBlinking.left ? "Left Wink" : face.eyesBlinking.right ? "Right Wink" : "Open"}
              </strong></span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-mono py-2 text-center">
            Position face within camera view for biometric detection
          </div>
        )}
      </div>

      {/* Hand Gesture Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left Hand Card */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            leftHand && leftHand.event !== "NONE"
              ? "bg-slate-900/90 border-cyan-500/50 shadow-md shadow-cyan-500/10"
              : "bg-slate-950/60 border-slate-800 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Hand className="w-3.5 h-3.5" /> Left Hand
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              {leftHand ? `${Math.round(leftHand.confidence * 100)}%` : "None"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-xl p-1.5 rounded-lg bg-slate-900 border border-slate-800">
              {GESTURE_ICONS[leftHand?.event || "NONE"]}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-white font-mono">
                {leftHand?.event ? leftHand.event.replace("_", " ") : "NO HAND"}
              </div>
            </div>
          </div>
        </div>

        {/* Right Hand Card */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            rightHand && rightHand.event !== "NONE"
              ? "bg-slate-900/90 border-pink-500/50 shadow-md shadow-pink-500/10"
              : "bg-slate-950/60 border-slate-800 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
              <Hand className="w-3.5 h-3.5" /> Right Hand
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-pink-950/80 text-pink-300 border border-pink-800/60">
              {rightHand ? `${Math.round(rightHand.confidence * 100)}%` : "None"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-xl p-1.5 rounded-lg bg-slate-900 border border-slate-800">
              {GESTURE_ICONS[rightHand?.event || "NONE"]}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-white font-mono">
                {rightHand?.event ? rightHand.event.replace("_", " ") : "NO HAND"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Event Stream Debug Drawer */}
      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-cyan-400" /> Standardized Event Bus
          </span>
          <button
            onClick={() => setShowJsonRaw((s) => !s)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
          >
            {showJsonRaw ? "Collapse JSON" : "View Live JSON"}
          </button>
        </div>

        {showJsonRaw && (
          <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-36">
            <pre>
              {latestEvent
                ? JSON.stringify(
                    {
                      timestamp: latestEvent.timestamp,
                      source: latestEvent.source,
                      hand: latestEvent.hand,
                      event: latestEvent.event,
                      confidence: latestEvent.confidence,
                      position: latestEvent.position,
                    },
                    null,
                    2
                  )
                : '// Waiting for gesture stream...'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
