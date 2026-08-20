import React, { useRef, useEffect, useState, useCallback } from "react";
import { gestureBus } from "../../../services/eventBus";
import type { GestureEvent } from "../../../types/vision";
import { Play, RotateCcw, Trophy, Clock, Zap, Target, Snowflake } from "lucide-react";
import confetti from "canvas-confetti";

type BalloonType = "normal" | "gold" | "bomb" | "freeze";

interface Balloon {
  id: number;
  x: number;
  y: number;
  speed: number;
  radius: number;
  color: string;
  points: number;
  type: BalloonType;
  wobblePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
}

export const BalloonPopGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [combo, setCombo] = useState<number>(1);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [currentGesture, setCurrentGesture] = useState<string>("NONE");

  // Game state in refs for the render loop
  const balloonsRef = useRef<Balloon[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(1);
  const isPlayingRef = useRef<boolean>(false);
  const isFrozenRef = useRef<boolean>(false);
  const freezeTimerRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const nextIdRef = useRef<number>(1);
  const animRef = useRef<number>(0);

  // Pointer tracked directly from event bus (always current)
  const pointerRef = useRef<{ x: number; y: number; isAction: boolean; lastActionTime: number }>({
    x: 0.5,
    y: 0.5,
    isAction: true,
    lastActionTime: 0,
  });

  // Subscribe to gesture bus directly
  useEffect(() => {
    const unsub = gestureBus.subscribe((event: GestureEvent) => {
      const nx = 1 - event.position[0];
      const ny = event.position[1];
      setCurrentGesture(event.event);

      // Any active hand position is capable of popping when hovering balloons
      const isAction = true;
      pointerRef.current = {
        x: nx,
        y: ny,
        isAction,
        lastActionTime: performance.now(),
      };
    });
    return unsub;
  }, []);

  const playSfx = useCallback((type: "pop" | "gold" | "bomb" | "freeze") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (type === "gold") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      } else if (type === "bomb") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      } else if (type === "freeze") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  const startGame = () => {
    balloonsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 1;
    isFrozenRef.current = false;
    freezeTimerRef.current = 0;
    setScore(0);
    setCombo(1);
    setTimeLeft(45);
    setIsFrozen(false);
    isPlayingRef.current = true;
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

  // Countdown timer
  useEffect(() => {
    if (!isPlaying) return;
    if (timeLeft <= 0) {
      stopGame();
      return;
    }
    const id = setInterval(() => {
      setTimeLeft((t) => t - 1);
      if (freezeTimerRef.current > 0) {
        freezeTimerRef.current -= 1;
        if (freezeTimerRef.current <= 0) {
          isFrozenRef.current = false;
          setIsFrozen(false);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, timeLeft]);

  // Main game loop
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
      const frozen = isFrozenRef.current;

      // Spawn balloons
      if (playing && ts - lastSpawnRef.current > (frozen ? 1200 : 550)) {
        lastSpawnRef.current = ts;
        if (balloonsRef.current.length < 14) {
          const r = Math.random();
          let type: BalloonType = "normal";
          let color = "#00f5d4";
          let points = 10;
          let radius = 28 + Math.random() * 14;

          if (r < 0.12) {
            type = "gold";
            color = "#fee440";
            points = 100;
            radius = 36;
          } else if (r < 0.22) {
            type = "bomb";
            color = "#ef4444";
            points = -50;
            radius = 32;
          } else if (r < 0.32) {
            type = "freeze";
            color = "#38bdf8";
            points = 25;
            radius = 30;
          } else {
            const cols = ["#f72585", "#7209b7", "#4361ee", "#00f5d4", "#4ade80"];
            color = cols[Math.floor(Math.random() * cols.length)];
            points = 10 + Math.floor(Math.random() * 15);
          }

          balloonsRef.current.push({
            id: nextIdRef.current++,
            x: 0.1 + Math.random() * 0.8,
            y: 1.1,
            speed: 0.0025 + Math.random() * 0.003,
            radius,
            color,
            points,
            type,
            wobblePhase: Math.random() * Math.PI * 2,
          });
        }
      }

      // Pointer pixel coords
      const ptr = pointerRef.current;
      const ptrX = ptr.x * w;
      const ptrY = ptr.y * h;

      const activeBalloons: Balloon[] = [];
      for (const b of balloonsRef.current) {
        if (playing) {
          b.y -= frozen ? b.speed * 0.3 : b.speed;
          b.x += Math.sin(ts * 0.002 + b.wobblePhase) * 0.0012;
        }

        const bx = b.x * w;
        const by = b.y * h;
        const popped = playing && Math.hypot(ptrX - bx, ptrY - by) < b.radius + 26;

        if (popped) {
          playSfx(b.type === "gold" ? "gold" : b.type === "bomb" ? "bomb" : b.type === "freeze" ? "freeze" : "pop");

          const earned = b.type === "bomb" ? b.points : b.points * comboRef.current;

          if (b.type === "bomb") {
            scoreRef.current = Math.max(0, scoreRef.current + earned);
            comboRef.current = 1;
            setScore(scoreRef.current);
            setCombo(1);
            floatingTextsRef.current.push({ id: nextIdRef.current++, text: "💣 -50!", x: bx, y: by, color: "#ef4444", alpha: 1, vy: -2 });
          } else if (b.type === "freeze") {
            isFrozenRef.current = true;
            freezeTimerRef.current = 6;
            scoreRef.current += b.points * comboRef.current;
            setScore(scoreRef.current);
            setIsFrozen(true);
            floatingTextsRef.current.push({ id: nextIdRef.current++, text: "❄️ FREEZE!", x: bx, y: by, color: "#38bdf8", alpha: 1, vy: -2 });
          } else {
            scoreRef.current += earned;
            comboRef.current = Math.min(10, comboRef.current + 1);
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            floatingTextsRef.current.push({ id: nextIdRef.current++, text: b.type === "gold" ? `⭐ +${earned}` : `+${earned}`, x: bx, y: by, color: b.color, alpha: 1, vy: -2 });
          }

          // Burst particles
          for (let i = 0; i < (b.type === "gold" ? 28 : 16); i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 2 + Math.random() * 7;
            particlesRef.current.push({
              x: bx,
              y: by,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              color: b.color,
              alpha: 1,
              size: 3 + Math.random() * 5,
            });
          }
        } else if (b.y > -0.15) {
          activeBalloons.push(b);

          // Draw balloon
          ctx.save();
          ctx.shadowColor = b.color;
          ctx.shadowBlur = b.type === "gold" ? 24 : 14;
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.ellipse(bx, by, b.radius * 0.82, b.radius, 0, 0, Math.PI * 2);
          ctx.fill();

          // Highlight shine
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.beginPath();
          ctx.ellipse(bx - b.radius * 0.22, by - b.radius * 0.28, b.radius * 0.28, b.radius * 0.2, -0.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          if (b.type !== "normal") {
            ctx.font = `${b.radius * 0.85}px Inter`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(b.type === "gold" ? "⭐" : b.type === "bomb" ? "💣" : "❄️", bx, by);
          }
          ctx.restore();
        }
      }
      balloonsRef.current = activeBalloons;

      // Floating score texts
      const activeTexts: FloatingText[] = [];
      for (const ft of floatingTextsRef.current) {
        ft.y += ft.vy;
        ft.alpha -= 0.022;
        if (ft.alpha > 0) {
          activeTexts.push(ft);
          ctx.save();
          ctx.globalAlpha = ft.alpha;
          ctx.fillStyle = ft.color;
          ctx.font = "bold 17px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = ft.color;
          ctx.shadowBlur = 8;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }
      }
      floatingTextsRef.current = activeTexts;

      // Particles
      const activeParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.alpha -= 0.028;
        if (p.alpha > 0) {
          activeParticles.push(p);
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      particlesRef.current = activeParticles;

      // Hand pointer cursor
      ctx.save();
      const pr = 16;
      ctx.beginPath();
      ctx.arc(ptrX, ptrY, pr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,245,212,0.3)";
      ctx.fill();
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00f5d4";
      ctx.shadowBlur = 14;
      ctx.stroke();

      // cross-hair
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.moveTo(ptrX - pr - 6, ptrY);
      ctx.lineTo(ptrX + pr + 6, ptrY);
      ctx.moveTo(ptrX, ptrY - pr - 6);
      ctx.lineTo(ptrX, ptrY + pr + 6);
      ctx.stroke();
      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [playSfx]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between items-center select-none">
      {/* Header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border shadow-lg z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Trophy className="w-4 h-4 text-yellow-400" /> Score: <strong className="text-white text-base ml-1">{score}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-pink-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-4 h-4 text-pink-400" /> Time: <strong className="text-white text-base ml-1">{timeLeft}s</strong>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Zap className="w-4 h-4 text-amber-400" /> Combo: <strong className="text-white text-base ml-1">x{combo}</strong>
          </div>
          {isFrozen && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 bg-cyan-950/80 px-3 py-1.5 rounded-lg border border-cyan-800 animate-pulse">
              <Snowflake className="w-4 h-4" /> FREEZE SLOW-MO
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Best: <strong className="text-cyan-400">{highScore}</strong></span>
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Game
            </button>
          ) : (
            <button
              onClick={stopGame}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg shadow-red-600/30"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Stop Game
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
          <span>Point or move your hand crosshair over balloons to pop! Avoid 💣 Bombs!</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Live Hand:</span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
            {currentGesture !== "NONE" ? `Active (${currentGesture})` : "Scanning Hand"}
          </span>
        </div>
      </div>

      {/* Arena */}
      <div className="relative w-full flex-1 my-2 bg-slate-950/85 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl flex items-center justify-center min-h-[480px]">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />

        {!isPlaying && timeLeft === 45 && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-4">
              <Target className="w-12 h-12 text-cyan-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-wide">BALLOON POP 2.0</h2>
            <p className="text-xs text-slate-300 max-w-md mb-6 leading-relaxed">
              Pop flying balloons with your hand crosshair in mid-air!
              <br />
              ⭐ <strong className="text-yellow-400">Gold (+100)</strong> • ❄️ <strong className="text-cyan-400">Freeze (slow-mo)</strong> • 💣 <strong className="text-red-400">Bomb (-50 AVOID!)</strong>
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 text-sm uppercase tracking-wider flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Play Now
            </button>
          </div>
        )}

        {!isPlaying && timeLeft <= 0 && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="text-3xl font-extrabold text-yellow-400 mb-2">TIME'S UP!</h2>
            <p className="text-sm text-slate-300 mb-4">Final Score: <strong className="text-cyan-300 font-mono text-2xl ml-2">{score}</strong></p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
