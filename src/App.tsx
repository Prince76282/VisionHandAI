import React, { useState, useEffect } from "react";
import { useCamera } from "./hooks/useCamera";
import type { AppMode, VisionFrameData } from "./types/vision";
import { CameraView } from "./components/CameraView";
import { StatsOverlay } from "./components/StatsOverlay";
import { AirDrawMode } from "./components/modes/AirDrawMode";
import { ObjectScanMode } from "./components/modes/ObjectScanMode";
import { GamesMode } from "./components/modes/GamesMode";
import {
  Hand,
  Activity,
  PenTool,
  Gamepad2,
  Sparkles,
  Camera,
  ShieldCheck,
  Sun,
  Moon,
  ScanSearch,
} from "lucide-react";

// ─── Theme hook ────────────────────────────────────────────────────────────────
function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("visionhand_theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem("visionhand_theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}

export function App() {
  const { videoRef, isActive, isLoading, error, toggleCamera } = useCamera();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [currentMode, setCurrentMode] = useState<AppMode>("live");
  const [frameData, setFrameData] = useState<VisionFrameData | null>(null);

  const MODES: Array<{
    id: AppMode;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }> = [
    {
      id: "live",
      label: "Live Tracking",
      icon: <Hand className="w-4 h-4" />,
      desc: "21-Point Hand Landmarks + Face & Age Recognition",
    },
    {
      id: "air_draw",
      label: "Air Drawing",
      icon: <PenTool className="w-4 h-4" />,
      desc: "Index Finger Mid-Air Canvas with Neon Brushes",
    },
    {
      id: "object_scan",
      label: "Object Scan",
      icon: <ScanSearch className="w-4 h-4" />,
      desc: "AI Object Detection via OpenRouter GPT-4o mini",
    },
    {
      id: "games",
      label: "Gesture Arcade",
      icon: <Gamepad2 className="w-4 h-4" />,
      desc: "Balloon Pop, Laser Slicer & Rock Paper Scissors",
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? "dark bg-cyber-dark text-slate-100" : "light bg-background text-foreground"}`}
    >
      {/* ─── Top Navigation Header ─────────────────────────────────────── */}
      <header
        className={`app-header w-full px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
              isDark
                ? "bg-gradient-to-tr from-cyan-500 to-emerald-400 shadow-cyan-500/25"
                : "bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-500/25"
            }`}
          >
            <Hand
              className={`w-5 h-5 ${isDark ? "text-slate-950" : "text-white"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className={`text-base sm:text-lg font-black tracking-tight bg-clip-text text-transparent ${
                  isDark
                    ? "bg-gradient-to-r from-white via-slate-200 to-cyan-300"
                    : "bg-gradient-to-r from-slate-900 via-blue-800 to-cyan-700"
                }`}
              >
                VisionHand
              </h1>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isDark
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "bg-blue-500/10 text-blue-600 border border-blue-500/25"
                }`}
              >
                AI CORE v2.0
              </span>
            </div>
            <p
              className={`text-[11px] hidden sm:block ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Client-Side MediaPipe + OpenRouter Neural Vision
            </p>
          </div>
        </div>

        {/* Mode Switcher Nav Tabs */}
        <nav
          className={`flex items-center gap-1 p-1 rounded-xl border ${
            isDark
              ? "bg-slate-900/90 border-slate-800"
              : "bg-slate-100/90 border-slate-200"
          }`}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setCurrentMode(m.id)}
              title={m.desc}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentMode === m.id
                  ? isDark
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25"
                  : isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {m.icon}
              <span className="hidden md:inline">{m.label}</span>
            </button>
          ))}
        </nav>

        {/* Right Cluster: Privacy badge + Theme Toggle */}
        <div className="flex items-center gap-2">
          <div
            className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono ${
              isDark
                ? "bg-slate-900/60 border-slate-800 text-emerald-400"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>100% Private</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={`p-2 rounded-xl border transition-all ${
              isDark
                ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-amber-500/40"
                : "bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm"
            }`}
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* ─── Main Dashboard ─────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Primary Stage (8 cols) ──────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col min-h-[580px] h-[calc(100vh-140px)]">
          {currentMode === "live" && (
            <CameraView
              videoRef={videoRef}
              isActive={isActive}
              isLoading={isLoading}
              error={error}
              onToggleCamera={toggleCamera}
              onFrameUpdate={setFrameData}
            />
          )}

          {currentMode === "air_draw" && <AirDrawMode />}

          {currentMode === "object_scan" && <ObjectScanMode />}

          {currentMode === "games" && <GamesMode />}
        </div>

        {/* ── Right Sidebar (4 cols) ────────────────────────────────────── */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Picture-in-Picture Camera (non-live modes) */}
          {currentMode !== "live" && currentMode !== "object_scan" && (
            <div
              className={`glass-panel p-3.5 rounded-2xl shadow-xl ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-cyan-400" : "text-indigo-600"}`}
                >
                  <Camera className="w-3.5 h-3.5" /> Background Vision Pipeline
                </span>
                <span
                  className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {isActive ? "Tracking Active" : "Camera Standby"}
                </span>
              </div>
              <div
                className={`w-full h-64 sm:h-72 min-h-[260px] rounded-xl overflow-hidden border relative ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"}`}
              >
                <CameraView
                  videoRef={videoRef}
                  isActive={isActive}
                  isLoading={isLoading}
                  error={error}
                  onToggleCamera={toggleCamera}
                  onFrameUpdate={setFrameData}
                />
              </div>
            </div>
          )}

          {/* Gesture Telemetry */}
          <div
            className={`glass-panel p-4 rounded-2xl shadow-xl flex flex-col gap-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}
          >
            <div className="flex items-center justify-between">
              <h2
                className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                <Activity
                  className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-indigo-500"}`}
                />
                Gesture Recognition Telemetry
              </h2>
              <span
                className={`text-xs font-mono ${isDark ? "text-cyan-400" : "text-indigo-600"}`}
              >
                {frameData?.handCount
                  ? `${frameData.handCount} Active`
                  : "0 Hands"}
              </span>
            </div>
            <StatsOverlay frameData={frameData} />
          </div>

          {/* Gestures Cheat Sheet */}
          <div
            className={`glass-panel p-4 rounded-2xl shadow-xl ${isDark ? "border-slate-800" : "border-slate-200"}`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${isDark ? "text-yellow-400" : "text-amber-500"}`}
              />
              Recognized Gestures Guide
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { emoji: "✋", label: "Open Palm" },
                { emoji: "✊", label: "Fist" },
                { emoji: "👍", label: "Thumbs Up" },
                { emoji: "👎", label: "Thumbs Down" },
                { emoji: "✌️", label: "Peace Sign" },
                { emoji: "🤏", label: "Pinch" },
                { emoji: "👉", label: "Point" },
                { emoji: "👌", label: "OK Sign" },
              ].map(({ emoji, label }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-900/60 border-slate-800 text-slate-300"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="text-base">{emoji}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
