import React, { useRef, useEffect, useState, useCallback } from "react";
import { gestureBus } from "../../../services/eventBus";
import type { GestureEvent } from "../../../types/vision";
import { Point2DFilter } from "../../../utils/oneEuroFilter";
import { Play, RotateCcw, Trophy, Gauge, Zap, Flame, Compass } from "lucide-react";
import confetti from "canvas-confetti";

interface TrafficCar {
  id: number;
  x: number; // -1 (far left) to 1 (far right)
  z: number; // 0 (near player) to 1000 (far horizon)
  speed: number;
  color: string;
  lane: number;
}

interface Collectible {
  id: number;
  x: number;
  z: number;
  type: "coin" | "nitro" | "shield";
  collected: boolean;
}

export const CarDriveGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [speedKmh, setSpeedKmh] = useState<number>(120);
  const [nitro, setNitro] = useState<number>(100);
  const [distanceM, setDistanceM] = useState<number>(0);
  const [currentGesture, setCurrentGesture] = useState<string>("NONE");
  const [steeringAngle, setSteeringAngle] = useState<number>(0);

  // References for ultra-smooth 60fps rendering without React re-renders
  const isPlayingRef = useRef<boolean>(false);
  const playerXRef = useRef<number>(0); // -1.0 to 1.0
  const targetXRef = useRef<number>(0);
  const playerSpeedRef = useRef<number>(120);
  const isBoostingRef = useRef<boolean>(false);
  const nitroRef = useRef<number>(100);
  const scoreRef = useRef<number>(0);
  const distanceRef = useRef<number>(0);
  const animIdRef = useRef<number>(0);
  const nextIdRef = useRef<number>(1);
  const trafficRef = useRef<TrafficCar[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const roadOffsetRef = useRef<number>(0);
  const steerFilterRef = useRef<Point2DFilter>(new Point2DFilter(1.8, 0.02));

  // Sound effects
  const playSfx = useCallback((type: "crash" | "coin" | "nitro" | "boost") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === "crash") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      } else if (type === "coin") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      } else if (type === "nitro") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {}
  }, []);

  // Subscribe directly to Gesture Event Bus for steering & throttle
  useEffect(() => {
    const unsubscribe = gestureBus.subscribe((event: GestureEvent) => {
      // Raw normalized hand X: 0 (left) to 1 (right) -> Mirrored: -1.0 to 1.0
      const mirroredX = (1 - event.position[0]) * 2 - 1;
      const [filteredX] = steerFilterRef.current.filter(mirroredX, 0, event.timestamp);

      // Steering target based on hand horizontal position
      targetXRef.current = Math.max(-1.1, Math.min(1.1, filteredX * 1.5));
      setSteeringAngle(Math.round(filteredX * 45));

      // Gesture actions
      setCurrentGesture(event.event);

      if (event.event === "POINT" || event.event === "THUMBS_UP") {
        isBoostingRef.current = true;
      } else {
        isBoostingRef.current = false;
      }

      // Gesture-specific steering override
      if (event.event === "FIST") {
        targetXRef.current = Math.max(-1.1, targetXRef.current - 0.4);
      } else if (event.event === "OPEN_PALM" && Math.abs(filteredX) < 0.2) {
        targetXRef.current = 0; // Center stabilization
      }
    });

    return unsubscribe;
  }, []);

  const startGame = () => {
    trafficRef.current = [];
    collectiblesRef.current = [];
    playerXRef.current = 0;
    targetXRef.current = 0;
    playerSpeedRef.current = 140;
    nitroRef.current = 100;
    scoreRef.current = 0;
    distanceRef.current = 0;

    setScore(0);
    setNitro(100);
    setDistanceM(0);
    setSpeedKmh(140);
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

  // Main 60 FPS Game Loop
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      const canvas = canvasRef.current;
      if (!canvas) {
        animIdRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // ── Update Logic ──
      if (isPlayingRef.current) {
        // Boost mechanics
        if (isBoostingRef.current && nitroRef.current > 0) {
          playerSpeedRef.current = Math.min(260, playerSpeedRef.current + 120 * dt);
          nitroRef.current = Math.max(0, nitroRef.current - 25 * dt);
        } else {
          playerSpeedRef.current = Math.max(120, playerSpeedRef.current - 60 * dt);
          nitroRef.current = Math.min(100, nitroRef.current + 8 * dt);
        }

        setSpeedKmh(Math.round(playerSpeedRef.current));
        setNitro(Math.round(nitroRef.current));

        // Smooth steering interpolation
        playerXRef.current += (targetXRef.current - playerXRef.current) * 8 * dt;

        // Odometer & Score
        distanceRef.current += (playerSpeedRef.current * 0.277) * dt;
        scoreRef.current += Math.round(playerSpeedRef.current * 0.1 * dt * 10);
        setDistanceM(Math.round(distanceRef.current));
        setScore(scoreRef.current);

        // Road movement
        roadOffsetRef.current = (roadOffsetRef.current + playerSpeedRef.current * dt * 8) % 100;

        // Spawn Traffic Cars
        if (Math.random() < 0.035 && trafficRef.current.length < 6) {
          const lanes = [-0.65, -0.22, 0.22, 0.65];
          const chosenLane = lanes[Math.floor(Math.random() * lanes.length)];
          const carColors = ["#ef4444", "#3b82f6", "#eab308", "#ec4899", "#8b5cf6"];

          trafficRef.current.push({
            id: nextIdRef.current++,
            x: chosenLane,
            z: 900,
            speed: 50 + Math.random() * 40,
            color: carColors[Math.floor(Math.random() * carColors.length)],
            lane: chosenLane,
          });
        }

        // Spawn Collectibles (Fuel / Nitro / Coins)
        if (Math.random() < 0.025 && collectiblesRef.current.length < 4) {
          const lanes = [-0.65, -0.22, 0.22, 0.65];
          collectiblesRef.current.push({
            id: nextIdRef.current++,
            x: lanes[Math.floor(Math.random() * lanes.length)],
            z: 900,
            type: Math.random() < 0.4 ? "nitro" : "coin",
            collected: false,
          });
        }

        // Update Traffic
        const survivingTraffic: TrafficCar[] = [];
        for (const car of trafficRef.current) {
          // relative speed difference
          car.z -= (playerSpeedRef.current - car.speed) * 3.5 * dt;

          // Collision detection with player at z ~ 60..140
          if (car.z > 40 && car.z < 130 && Math.abs(car.x - playerXRef.current) < 0.28) {
            playSfx("crash");
            stopGame();
            return;
          }

          if (car.z > 20) {
            survivingTraffic.push(car);
          }
        }
        trafficRef.current = survivingTraffic;

        // Update Collectibles
        const survivingCollectibles: Collectible[] = [];
        for (const item of collectiblesRef.current) {
          item.z -= playerSpeedRef.current * 3.5 * dt;

          // Collect collision
          if (!item.collected && item.z > 40 && item.z < 130 && Math.abs(item.x - playerXRef.current) < 0.32) {
            item.collected = true;
            if (item.type === "nitro") {
              nitroRef.current = Math.min(100, nitroRef.current + 40);
              scoreRef.current += 150;
              playSfx("nitro");
            } else {
              scoreRef.current += 100;
              playSfx("coin");
            }
          }

          if (item.z > 20 && !item.collected) {
            survivingCollectibles.push(item);
          }
        }
        collectiblesRef.current = survivingCollectibles;
      }

      // ── Render 3D Perspective Highway ──
      ctx.clearRect(0, 0, w, h);

      // 1. Cyber Synthwave Sky & Horizon
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.48);
      skyGrad.addColorStop(0, "#090d16");
      skyGrad.addColorStop(0.6, "#151b2e");
      skyGrad.addColorStop(1, "#311847");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.48);

      // Neon Horizon Sun
      const sunGrad = ctx.createRadialGradient(w / 2, h * 0.48, 10, w / 2, h * 0.48, 90);
      sunGrad.addColorStop(0, "#f72585");
      sunGrad.addColorStop(0.5, "#7209b7");
      sunGrad.addColorStop(1, "transparent");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.48, 90, Math.PI, 0);
      ctx.fill();

      // Horizon line
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.48);
      ctx.lineTo(w, h * 0.48);
      ctx.stroke();

      // 2. 3D Perspective Road
      const horizonY = h * 0.48;
      const roadTopW = w * 0.12;
      const roadBotW = w * 0.88;
      const roadTopX1 = w / 2 - roadTopW / 2;
      const roadTopX2 = w / 2 + roadTopW / 2;
      const roadBotX1 = w / 2 - roadBotW / 2;
      const roadBotX2 = w / 2 + roadBotW / 2;

      // Grass / roadside
      ctx.fillStyle = "#070a12";
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Road Surface
      ctx.fillStyle = "#111625";
      ctx.beginPath();
      ctx.moveTo(roadTopX1, horizonY);
      ctx.lineTo(roadTopX2, horizonY);
      ctx.lineTo(roadBotX2, h);
      ctx.lineTo(roadBotX1, h);
      ctx.closePath();
      ctx.fill();

      // Neon Road Borders
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#00f5d4";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(roadTopX1, horizonY);
      ctx.lineTo(roadBotX1, h);
      ctx.moveTo(roadTopX2, horizonY);
      ctx.lineTo(roadBotX2, h);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Road Lane Dashes
      const numSegments = 16;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      for (let i = 0; i < numSegments; i++) {
        const segProgress = (i / numSegments + roadOffsetRef.current * 0.01) % 1;
        const segY = horizonY + Math.pow(segProgress, 2) * (h - horizonY);
        const segW = roadTopW + Math.pow(segProgress, 2) * (roadBotW - roadTopW);
        const segH = 8 * segProgress + 2;

        if (i % 2 === 0) {
          ctx.lineWidth = 2 + segProgress * 3;
          // Left Lane Mark
          const lx = w / 2 - segW * 0.25;
          ctx.beginPath();
          ctx.moveTo(lx, segY);
          ctx.lineTo(lx, segY + segH);
          ctx.stroke();

          // Right Lane Mark
          const rx = w / 2 + segW * 0.25;
          ctx.beginPath();
          ctx.moveTo(rx, segY);
          ctx.lineTo(rx, segY + segH);
          ctx.stroke();
        }
      }

      // Helper function: Project 3D (x, z) to 2D screen coordinates
      const project3D = (laneX: number, z: number) => {
        const p = Math.max(0.01, 1 - z / 950);
        const screenY = horizonY + Math.pow(p, 2.2) * (h - horizonY);
        const currentRoadW = roadTopW + Math.pow(p, 2.2) * (roadBotW - roadTopW);
        const screenX = w / 2 + laneX * (currentRoadW * 0.45);
        const scale = p;
        return { screenX, screenY, scale };
      };

      // 3. Render Collectibles
      for (const item of collectiblesRef.current) {
        const { screenX, screenY, scale } = project3D(item.x, item.z);
        if (scale > 0.05) {
          const itemSize = Math.max(12, scale * 40);
          ctx.save();
          ctx.font = `${itemSize}px Inter`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = item.type === "nitro" ? "#38bdf8" : "#facc15";
          ctx.shadowBlur = 15;
          ctx.fillText(item.type === "nitro" ? "⚡" : "💎", screenX, screenY);
          ctx.restore();
        }
      }

      // 4. Render Traffic Cars (Back-to-Front z-sorting)
      const sortedTraffic = [...trafficRef.current].sort((a, b) => b.z - a.z);
      for (const car of sortedTraffic) {
        const { screenX, screenY, scale } = project3D(car.x, car.z);
        if (scale > 0.05) {
          const carW = Math.max(14, scale * 75);
          const carH = Math.max(8, scale * 45);

          ctx.save();
          ctx.translate(screenX, screenY);

          // Car Body
          ctx.fillStyle = car.color;
          ctx.shadowColor = car.color;
          ctx.shadowBlur = 10 * scale;
          ctx.beginPath();
          ctx.roundRect(-carW / 2, -carH / 2, carW, carH, 4 * scale);
          ctx.fill();

          // Windshield
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(-carW * 0.35, -carH * 0.35, carW * 0.7, carH * 0.35);

          // Taillights
          ctx.fillStyle = "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 8;
          ctx.fillRect(-carW * 0.42, carH * 0.2, carW * 0.2, carH * 0.2);
          ctx.fillRect(carW * 0.22, carH * 0.2, carW * 0.2, carH * 0.2);

          ctx.restore();
        }
      }

      // 5. Render Player's Cyber Sports Car
      const playerScreenY = h * 0.84;
      const playerScreenX = w / 2 + playerXRef.current * (roadBotW * 0.42);
      const pW = 86;
      const pH = 52;

      ctx.save();
      ctx.translate(playerScreenX, playerScreenY);

      // Nitro Flame Exhaust when boosting
      if (isBoostingRef.current && nitroRef.current > 0) {
        ctx.fillStyle = "#00f5d4";
        ctx.shadowColor = "#00f5d4";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(-pW * 0.25, pH / 2);
        ctx.lineTo(-pW * 0.15, pH / 2 + 35 + Math.random() * 15);
        ctx.lineTo(-pW * 0.05, pH / 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pW * 0.05, pH / 2);
        ctx.lineTo(pW * 0.15, pH / 2 + 35 + Math.random() * 15);
        ctx.lineTo(pW * 0.25, pH / 2);
        ctx.fill();
      }

      // Car Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.ellipse(0, pH * 0.45, pW * 0.55, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cyberpunk Car Chassis
      ctx.fillStyle = "#00f5d4";
      ctx.shadowColor = "#00f5d4";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(-pW / 2, -pH / 2, pW, pH, 10);
      ctx.fill();

      // Cabin / Roof
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.roundRect(-pW * 0.38, -pH * 0.4, pW * 0.76, pH * 0.65, 6);
      ctx.fill();

      // Windshield Cyan Tint
      ctx.fillStyle = "rgba(6, 182, 212, 0.65)";
      ctx.fillRect(-pW * 0.32, -pH * 0.32, pW * 0.64, pH * 0.25);

      // Cyber Taillight LED Strip
      ctx.fillStyle = isBoostingRef.current ? "#f72585" : "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 14;
      ctx.fillRect(-pW * 0.42, pH * 0.32, pW * 0.84, 6);

      ctx.restore();

      // 6. Holographic Steering Wheel HUD
      const wheelX = w * 0.12;
      const wheelY = h * 0.82;
      const wheelR = 38;

      ctx.save();
      ctx.translate(wheelX, wheelY);
      ctx.rotate((steeringAngle * Math.PI) / 180);

      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#00f5d4";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
      ctx.stroke();

      // Wheel Spokes
      ctx.beginPath();
      ctx.moveTo(-wheelR, 0);
      ctx.lineTo(wheelR, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, wheelR);
      ctx.stroke();

      // Center Hub
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      animIdRef.current = requestAnimationFrame(loop);
    };

    animIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animIdRef.current);
  }, [playSfx]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between items-center select-none">
      {/* Top Telemetry Header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border z-10 shadow-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Score: <strong className="text-white text-base">{score}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>Speed: <strong className="text-white text-base">{speedKmh} KM/H</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Nitro: <strong className="text-white text-base">{nitro}%</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Compass className="w-4 h-4 text-purple-400" />
            <span>Dist: <strong className="text-white text-base">{distanceM}m</strong></span>
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
              <span>Start Driving</span>
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

      {/* Hand Gesture Suggestion Banner */}
      <div className="w-full mt-2 px-3.5 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
            💡 HAND GUIDE
          </span>
          <span className="hidden sm:inline">Move Hand Left/Right to Steer • 👉 Point Finger for Turbo Nitro Boost</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Live Gesture:</span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
            {currentGesture} ({steeringAngle > 5 ? "Steering Right ➔" : steeringAngle < -5 ? "⬅ Steering Left" : "Centered"})
          </span>
        </div>
      </div>

      {/* Main Canvas Highway Arena */}
      <div className="relative w-full flex-1 my-2 bg-slate-950/85 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl flex items-center justify-center min-h-[480px]">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />

        {/* Start Overlay */}
        {!isPlaying && distanceM === 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4 shadow-glow">
              <Flame className="w-12 h-12 text-cyan-400 animate-pulse" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-wide">CYBER HIGHWAY RACER 🏎️</h2>
            <p className="text-xs text-slate-300 max-w-md mb-6 leading-relaxed">
              Steer your futuristic sports car with your hand in mid-air!
              <br />
              🖐️ <strong>Move Hand Left/Right</strong> to steer the wheel
              <br />
              👉 <strong>Point Finger</strong> for Turbo Nitro Boost
              <br />
              🚗 <strong>Dodge traffic</strong> • 💎 <strong>Collect Gems & Fuel</strong>
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all text-sm tracking-wider uppercase flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Ignite Engine</span>
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {!isPlaying && distanceM > 0 && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="text-3xl font-extrabold text-red-400 mb-2">CRASH! GAME OVER</h2>
            <p className="text-sm text-slate-300 mb-4">Distance: <strong className="text-cyan-300 font-mono text-xl">{distanceM}m</strong></p>
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 mb-6 w-64">
              <div className="text-xs text-slate-400 uppercase font-semibold">Final Score</div>
              <div className="text-3xl font-extrabold text-white font-mono">{score}</div>
            </div>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Race Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
