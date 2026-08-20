import React, { useRef, useEffect, useState, useCallback } from "react";
import { gestureBus } from "../../../services/eventBus";
import type { GestureEvent } from "../../../types/vision";
import { Point2DFilter } from "../../../utils/oneEuroFilter";
import { Play, RotateCcw, Trophy, Heart, Zap, Flame } from "lucide-react";
import confetti from "canvas-confetti";

interface SliceTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  emoji: string;
  points: number;
  isBomb: boolean;
  rotation: number;
  rotSpeed: number;
}

interface SlicedHalf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  emoji: string;
  alpha: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

const TARGET_TYPES = [
  { emoji: "🍉", color: "#4ade80", points: 15, isBomb: false },
  { emoji: "🍊", color: "#fb923c", points: 20, isBomb: false },
  { emoji: "💎", color: "#38bdf8", points: 35, isBomb: false },
  { emoji: "⭐", color: "#fee440", points: 50, isBomb: false },
  { emoji: "🔥", color: "#f72585", points: 25, isBomb: false },
  { emoji: "💣", color: "#ef4444", points: -1, isBomb: true },
];

// Helper: Distance from point P to line segment AB
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  return Math.hypot(px - projX, py - projY);
}

export const LaserSliceGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(1);
  const [slices, setSlices] = useState<number>(0);
  const [currentGesture, setCurrentGesture] = useState<string>("NONE");

  const targetsRef = useRef<SliceTarget[]>([]);
  const halvesRef = useRef<SlicedHalf[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const trailRef = useRef<Array<{ x: number; y: number; ts: number }>>([]);
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(1);
  const livesRef = useRef<number>(3);
  const slicesRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const lastSpawnRef = useRef<number>(0);
  const nextIdRef = useRef<number>(1);
  const animRef = useRef<number>(0);
  const filterRef = useRef<Point2DFilter>(new Point2DFilter(1.8, 0.02));

  // Sound effects
  const playSfx = useCallback((isBomb = false) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (isBomb) {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // Subscribe to Gesture Event Bus for instant, continuous tracking
  useEffect(() => {
    const unsub = gestureBus.subscribe((event: GestureEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rawX = (1 - event.position[0]) * canvas.width;
      const rawY = event.position[1] * canvas.height;
      const [sx, sy] = filterRef.current.filter(rawX, rawY, event.timestamp);

      const now = performance.now();
      trailRef.current.push({ x: sx, y: sy, ts: now });
      trailRef.current = trailRef.current.filter((p) => now - p.ts < 240);
      setCurrentGesture(event.event);
    });
    return unsub;
  }, []);

  const startGame = () => {
    targetsRef.current = [];
    halvesRef.current = [];
    sparksRef.current = [];
    trailRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 1;
    livesRef.current = 3;
    slicesRef.current = 0;
    isPlayingRef.current = true;
    setScore(0);
    setCombo(1);
    setLives(3);
    setSlices(0);
    setIsPlaying(true);
  };

  const stopGame = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  };

  useEffect(() => {
    const loop = (ts: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const playing = isPlayingRef.current;
      const trail = trailRef.current;

      // Spawn Targets
      if (playing && ts - lastSpawnRef.current > 650) {
        lastSpawnRef.current = ts;
        if (targetsRef.current.length < 8) {
          const cfg = TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)];
          const sx = 0.15 * w + Math.random() * 0.7 * w;
          targetsRef.current.push({
            id: nextIdRef.current++,
            x: sx,
            y: h + 40,
            vx: (w / 2 - sx) * 0.002 + (Math.random() - 0.5) * 4,
            vy: -(11 + Math.random() * 5),
            radius: 36,
            color: cfg.color,
            emoji: cfg.emoji,
            points: cfg.points,
            isBomb: cfg.isBomb,
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 0.08,
          });
        }
      }

      // Check Slices across line segments in recent blade trail
      const activeTargets: SliceTarget[] = [];
      for (const t of targetsRef.current) {
        if (playing) {
          t.x += t.vx;
          t.y += t.vy;
          t.vy += 0.22;
          t.rotation += t.rotSpeed;
        }

        let isSliced = false;

        // Line-segment collision detection with all recent blade segments
        if (playing && trail.length >= 1) {
          if (trail.length === 1) {
            const p = trail[0];
            if (Math.hypot(p.x - t.x, p.y - t.y) < t.radius + 24) {
              isSliced = true;
            }
          } else {
            for (let i = 0; i < trail.length - 1; i++) {
              const p1 = trail[i];
              const p2 = trail[i + 1];
              const d = distToSegment(t.x, t.y, p1.x, p1.y, p2.x, p2.y);
              if (d < t.radius + 24) {
                isSliced = true;
                break;
              }
            }
          }
        }

        if (isSliced) {
          playSfx(t.isBomb);
          if (t.isBomb) {
            livesRef.current = Math.max(0, livesRef.current - 1);
            comboRef.current = 1;
            setLives(livesRef.current);
            setCombo(1);
            if (livesRef.current <= 0) {
              stopGame();
              return;
            }
          } else {
            scoreRef.current += t.points * comboRef.current;
            comboRef.current = Math.min(8, comboRef.current + 1);
            slicesRef.current += 1;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setSlices(slicesRef.current);
          }

          // Split Halves
          halvesRef.current.push(
            { id: nextIdRef.current++, x: t.x - 12, y: t.y, vx: -3.5, vy: -2.5, radius: t.radius * 0.7, emoji: t.emoji, alpha: 1 },
            { id: nextIdRef.current++, x: t.x + 12, y: t.y, vx: 3.5, vy: -2.5, radius: t.radius * 0.7, emoji: t.emoji, alpha: 1 }
          );

          // Sparks
          for (let i = 0; i < 22; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 2 + Math.random() * 8;
            sparksRef.current.push({
              x: t.x,
              y: t.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              color: t.color,
              alpha: 1,
              size: 3 + Math.random() * 4,
            });
          }
        } else if (t.y < h + 80) {
          activeTargets.push(t);
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(t.rotation);
          ctx.shadowColor = t.color;
          ctx.shadowBlur = 18;
          ctx.font = `${t.radius * 1.5}px Inter`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(t.emoji, 0, 0);
          ctx.restore();
        }
      }
      targetsRef.current = activeTargets;

      // Render Sliced Halves
      const activeHalves: SlicedHalf[] = [];
      for (const hf of halvesRef.current) {
        hf.x += hf.vx;
        hf.y += hf.vy;
        hf.vy += 0.28;
        hf.alpha -= 0.025;
        if (hf.alpha > 0) {
          activeHalves.push(hf);
          ctx.save();
          ctx.globalAlpha = hf.alpha;
          ctx.font = `${hf.radius * 1.3}px Inter`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(hf.emoji, hf.x, hf.y);
          ctx.restore();
        }
      }
      halvesRef.current = activeHalves;

      // Render Sparks
      const activeSparks: Spark[] = [];
      for (const sp of sparksRef.current) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.2;
        sp.alpha -= 0.035;
        if (sp.alpha > 0) {
          activeSparks.push(sp);
          ctx.save();
          ctx.globalAlpha = sp.alpha;
          ctx.fillStyle = sp.color;
          ctx.shadowColor = sp.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      sparksRef.current = activeSparks;

      // Glowing Katana Blade Trail
      if (trail.length >= 2) {
        ctx.save();
        const now = performance.now();
        for (let i = 0; i < trail.length - 1; i++) {
          const a = trail[i];
          const b2 = trail[i + 1];
          const age = (now - a.ts) / 240;
          const alpha = Math.max(0, 1 - age);
          const width = alpha * 16 + 2;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.strokeStyle = `rgba(0, 245, 212, ${alpha * 0.95})`;
          ctx.lineWidth = width;
          ctx.lineCap = "round";
          ctx.shadowColor = "#00f5d4";
          ctx.shadowBlur = 24;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.lineWidth = width * 0.4;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Blade Tip Laser Orb
      const tip = trail.length > 0 ? trail[trail.length - 1] : null;
      if (tip) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#00f5d4";
        ctx.shadowColor = "#00f5d4";
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [playSfx]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between items-center select-none">
      {/* Top Header Stats */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border z-10 shadow-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Score: <strong className="text-white text-base">{score}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-red-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Heart className="w-4 h-4 text-red-500 fill-current" />
            <span>Lives: <strong className="text-white text-base">{"❤️".repeat(Math.max(0, lives))}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Combo: <strong className="text-white text-base">x{combo}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">High Score: <strong className="text-cyan-400">{highScore}</strong></span>
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Slicing</span>
            </button>
          ) : (
            <button
              onClick={stopGame}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg shadow-red-600/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Stop Game</span>
            </button>
          )}
        </div>
      </div>

      {/* Hand Gesture Suggestion Guide */}
      <div className="w-full mt-2 px-3.5 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
            💡 HAND GUIDE
          </span>
          <span>Wave your finger or hand across flying fruits to slice! Avoid 💣 Bomb Mines!</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Live Hand:</span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
            {currentGesture !== "NONE" ? `Active (${currentGesture})` : "Scanning Hand"}
          </span>
        </div>
      </div>

      {/* Main Arena */}
      <div className="relative w-full flex-1 my-2 bg-slate-950/85 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl flex items-center justify-center min-h-[480px]">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />

        {/* Start Overlay */}
        {!isPlaying && slices === 0 && lives === 3 && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4 shadow-glow">
              <Flame className="w-12 h-12 text-cyan-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-wide">LASER BLADE SLICER</h2>
            <p className="text-xs text-slate-300 max-w-md mb-6 leading-relaxed">
              Slice through flying targets using your hand as a glowing laser katana!
              <br />
              🍉 🍊 💎 ⭐ Slice targets for combos • 💣 <strong>Avoid Bomb Mines!</strong>
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all text-sm tracking-wider uppercase flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Ignite Laser</span>
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {!isPlaying && (lives <= 0 || (score > 0 && !isPlaying && slices > 0)) && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="text-3xl font-extrabold text-red-400 mb-2">GAME OVER</h2>
            <p className="text-sm text-slate-300 mb-4">Total Slices: <strong className="text-cyan-300 font-mono text-xl">{slices}</strong></p>
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 mb-6 w-64">
              <div className="text-xs text-slate-400 uppercase font-semibold">Final Score</div>
              <div className="text-3xl font-extrabold text-white font-mono">{score}</div>
            </div>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
