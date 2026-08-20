import React, { useRef, useState, useCallback, useEffect } from "react";
import { useGestureEvents } from "../../hooks/useGestureEvents";
import type { GestureEvent } from "../../types/vision";
import { 
  MousePointer2, 
  Sparkles, 
  ToggleLeft, 
  ToggleRight, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Layers, 
  Zap,
  Target
} from "lucide-react";

interface ClickEffect {
  id: number;
  x: number;
  y: number;
  color: string;
}

export const CursorControlMode: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([]);
  const lastClickTimeRef = useRef<number>(0);

  // Interactive playground states
  const [clickCount, setClickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("Alpha");
  const [toggleStateA, setToggleStateA] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastActionMessage, setLastActionMessage] = useState<string>("Move index finger to aim, Pinch to click");

  // Play synthetic tone on click
  const playClickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(620, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {
      // AudioContext might be restricted until user gesture
    }
  }, [soundEnabled]);

  // Handle incoming gesture events strictly from event bus
  const handleGestureEvent = useCallback(
    (event: GestureEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenX = rect.left + (1 - event.position[0]) * rect.width;
      const screenY = rect.top + event.position[1] * rect.height;

      const boundedX = Math.max(rect.left, Math.min(rect.right, screenX));
      const boundedY = Math.max(rect.top, Math.min(rect.bottom, screenY));

      setCursorPos({ x: boundedX, y: boundedY });

      const pinchActive = event.event === "PINCH" && event.confidence >= 0.7;
      const now = performance.now();

      if (pinchActive && !isPinching) {
        setIsPinching(true);
        if (now - lastClickTimeRef.current > 350) {
          lastClickTimeRef.current = now;

          const newEffect: ClickEffect = {
            id: now,
            x: boundedX,
            y: boundedY,
            color: event.hand === "left" ? "#00f5d4" : "#f72585",
          };
          setClickEffects((prev) => [...prev.slice(-8), newEffect]);
          playClickSound();

          const elem = document.elementFromPoint(boundedX, boundedY) as HTMLElement | null;
          if (elem) {
            const clickable = elem.closest("button, [data-clickable='true'], input") as HTMLElement | null;
            if (clickable) {
              clickable.click();
              setLastActionMessage(`Clicked: ${clickable.innerText || clickable.getAttribute("aria-label") || "Interactive Target"}`);
            } else {
              setLastActionMessage(`Pinch Click at (${Math.round(boundedX)}, ${Math.round(boundedY)})`);
            }
          }
        }
      } else if (!pinchActive && isPinching) {
        setIsPinching(false);
      }
    },
    [isPinching, playClickSound]
  );

  useGestureEvents(handleGestureEvent);

  useEffect(() => {
    if (clickEffects.length === 0) return;
    const timer = setTimeout(() => {
      setClickEffects((prev) => prev.slice(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [clickEffects]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full p-6 flex flex-col justify-between overflow-hidden bg-slate-950/60 rounded-2xl border border-cyan-500/20 select-none"
    >
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-cyber-card/80 backdrop-blur-md rounded-xl border border-cyber-border z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <MousePointer2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">In-App Virtual Cursor Control</h3>
            <p className="text-xs text-slate-400">Aim with Index Fingertip • Pinch Thumb & Index to Click</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Status:</span>
            <span className={isPinching ? "text-pink-400 font-bold animate-pulse" : "text-cyan-300"}>
              {isPinching ? "PINCH (CLICKING)" : "HOVERING"}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            {lastActionMessage}
          </div>
        </div>
      </div>

      {/* Interactive In-App Playground */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 z-10">
        {/* Card 1: Clicker Counter & Score */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Target Button
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono">
                Hits: {clickCount}
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Pinch while aiming directly at this button to register precision air-clicks.
            </p>
          </div>

          <button
            data-clickable="true"
            onClick={() => setClickCount((c) => c + 1)}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 active:scale-95 text-slate-950 font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Pinch Click Me! (+1)</span>
          </button>
        </div>

        {/* Card 2: Interactive Switches & Toggles */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
          <div>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Sliders className="w-4 h-4" /> System Controls
            </span>
            <p className="text-xs text-slate-300 mb-4">Toggle settings and sound cues inside the app.</p>
          </div>

          <div className="space-y-3">
            <button
              data-clickable="true"
              onClick={() => setSoundEnabled((s) => !s)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            >
              <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                Audio Feedback
              </span>
              <span className={`text-xs font-mono font-bold ${soundEnabled ? "text-cyan-400" : "text-slate-500"}`}>
                {soundEnabled ? "ON" : "MUTED"}
              </span>
            </button>

            <button
              data-clickable="true"
              onClick={() => setToggleStateA((t) => !t)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            >
              <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-pink-400" /> Boost Mode
              </span>
              {toggleStateA ? (
                <ToggleRight className="w-5 h-5 text-pink-400" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Card 3: Tabs & Selection Matrix */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Layers className="w-4 h-4" /> Segment Selector
            </span>
            <p className="text-xs text-slate-300 mb-4">Click distinct tabs to switch content.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
            {["Alpha", "Beta", "Gamma"].map((tab) => (
              <button
                key={tab}
                data-clickable="true"
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between z-10">
        <span>Web-isolated laser pointer • Safe client-side element targeting</span>
        <span className="text-cyan-400 font-mono">VisionHand Engine v1.0</span>
      </div>

      {/* Floating Laser Pointer On-Screen Cursor */}
      {cursorPos && (
        <div
          className="fixed pointer-events-none z-50 transition-transform duration-75 ease-out"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className={`relative flex items-center justify-center transition-all ${
              isPinching ? "scale-125" : "scale-100"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 ${
                isPinching
                  ? "border-pink-400 bg-pink-500/30 shadow-[0_0_20px_#f72585]"
                  : "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_#00f5d4]"
              } animate-ping absolute opacity-75`}
            />
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isPinching ? "bg-pink-400" : "bg-cyan-400"
              } shadow-lg`}
            />
          </div>
        </div>
      )}

      {/* Click Visual Ripple Effects */}
      {clickEffects.map((eff) => (
        <div
          key={eff.id}
          className="fixed pointer-events-none z-40 rounded-full border-2 animate-ping"
          style={{
            left: `${eff.x}px`,
            top: `${eff.y}px`,
            width: "50px",
            height: "50px",
            transform: "translate(-50%, -50%)",
            borderColor: eff.color,
            boxShadow: `0 0 25px ${eff.color}`,
          }}
        />
      ))}
    </div>
  );
};
