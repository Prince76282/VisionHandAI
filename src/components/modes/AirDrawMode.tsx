import React, { useRef, useEffect, useState, useCallback } from "react";
import { useGestureEvents } from "../../hooks/useGestureEvents";
import type { GestureEvent } from "../../types/vision";
import { Point2DFilter } from "../../utils/oneEuroFilter";
import {
  Trash2, Undo2, Download, Brush, Check, Sparkles, Zap, Eraser, Info, Star
} from "lucide-react";

type BrushType = "neon" | "rainbow" | "sparkle" | "laser" | "eraser";
type BackgroundType = "dark" | "grid" | "stars";

interface Point { x: number; y: number; }
interface Stroke { points: Point[]; color: string; size: number; type: BrushType; }

const COLOR_PALETTE = [
  "#00f5d4", "#f72585", "#7209b7", "#fee440",
  "#38bdf8", "#4ade80", "#ff5722", "#ffffff",
];

export const AirDrawMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── All mutable drawing state in refs to avoid stale closures ──
  const strokesRef      = useRef<Stroke[]>([]);
  const currentPtsRef   = useRef<Point[]>([]);
  const isDrawingRef    = useRef<boolean>(false);
  const brushColorRef   = useRef<string>("#00f5d4");
  const brushSizeRef    = useRef<number>(6);
  const brushTypeRef    = useRef<BrushType>("neon");
  const bgTypeRef       = useRef<BackgroundType>("dark");
  const cursorPosRef    = useRef<Point | null>(null);
  const penFilterRef    = useRef<Point2DFilter>(new Point2DFilter(1.2, 0.008));
  const animFrameRef    = useRef<number>(0);

  // ── React state for UI re-renders only ──
  const [brushColor, setBrushColorState] = useState("#00f5d4");
  const [brushSize,  setBrushSizeState]  = useState(6);
  const [brushType,  setBrushTypeState]  = useState<BrushType>("neon");
  const [bgType,     setBgTypeState]     = useState<BackgroundType>("dark");
  const [strokeCount, setStrokeCount]   = useState(0);
  const [isDrawing,   setIsDrawingUI]   = useState(false);
  const [showHelper,  setShowHelper]    = useState(true);

  // Sync UI state → refs
  const setBrushColor = (c: string)          => { brushColorRef.current = c; setBrushColorState(c); };
  const setBrushSize  = (s: number)          => { brushSizeRef.current  = s; setBrushSizeState(s); };
  const setBrushType  = (t: BrushType)       => { brushTypeRef.current  = t; setBrushTypeState(t); };
  const setBgType     = (b: BackgroundType)  => { bgTypeRef.current     = b; setBgTypeState(b); };

  // ── Gesture event handler — no stale closure issues ──────────────────────
  const handleGestureEvent = useCallback((event: GestureEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rawX = (1 - event.position[0]) * canvas.width;
    const rawY = event.position[1] * canvas.height;
    const [smoothX, smoothY] = penFilterRef.current.filter(rawX, rawY, event.timestamp);
    cursorPosRef.current = { x: smoothX, y: smoothY };

    const drawTriggered =
      (event.event === "PINCH" || event.event === "POINT") &&
      event.confidence >= 0.60;

    if (drawTriggered) {
      if (!isDrawingRef.current) {
        // Pen down
        isDrawingRef.current = true;
        setIsDrawingUI(true);
        currentPtsRef.current = [{ x: smoothX, y: smoothY }];
      } else {
        // Continue stroke — reject teleport jumps > 120px
        const pts = currentPtsRef.current;
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          const jumpDist = Math.hypot(smoothX - last.x, smoothY - last.y);
          if (jumpDist > 120) {
            // commit current stroke and start fresh
            if (pts.length > 1) {
              strokesRef.current = [
                ...strokesRef.current,
                { points: [...pts], color: brushColorRef.current, size: brushSizeRef.current, type: brushTypeRef.current },
              ];
              setStrokeCount(strokesRef.current.length);
            }
            currentPtsRef.current = [{ x: smoothX, y: smoothY }];
          } else {
            currentPtsRef.current = [...pts, { x: smoothX, y: smoothY }];
          }
        } else {
          currentPtsRef.current = [{ x: smoothX, y: smoothY }];
        }
      }
    } else {
      if (isDrawingRef.current) {
        // Pen up — commit stroke
        const pts = currentPtsRef.current;
        if (pts.length > 1) {
          strokesRef.current = [
            ...strokesRef.current,
            { points: [...pts], color: brushColorRef.current, size: brushSizeRef.current, type: brushTypeRef.current },
          ];
          setStrokeCount(strokesRef.current.length);
        }
        currentPtsRef.current = [];
        isDrawingRef.current  = false;
        setIsDrawingUI(false);
      }
    }
  }, []); // stable — reads only refs

  useGestureEvents(handleGestureEvent);

  // ── Canvas render function (called every rAF frame) ──────────────────────
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { animFrameRef.current = requestAnimationFrame(renderFrame); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx)   { animFrameRef.current = requestAnimationFrame(renderFrame); return; }

    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.clearRect(0, 0, w, h);
    if (bgTypeRef.current === "grid") {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.10)";
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    } else if (bgTypeRef.current === "stars") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      for (let i = 0; i < 60; i++) {
        const sx = (i * 113.5) % w;
        const sy = (i * 247.7) % h;
        ctx.beginPath(); ctx.arc(sx, sy, (i % 3) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Render all committed strokes + current live stroke
    const allStrokes: Stroke[] = [
      ...strokesRef.current,
      ...(currentPtsRef.current.length > 0
        ? [{ points: currentPtsRef.current, color: brushColorRef.current, size: brushSizeRef.current, type: brushTypeRef.current }]
        : []),
    ];

    for (const stroke of allStrokes) {
      renderStroke(ctx, stroke);
    }

    // Cursor reticle
    const cp = cursorPosRef.current;
    const drawing = isDrawingRef.current;
    if (cp) {
      ctx.save();
      const cr = brushSizeRef.current / 2 + 5;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cr, 0, Math.PI * 2);
      ctx.strokeStyle = drawing ? "#ffffff" : brushColorRef.current;
      ctx.lineWidth = drawing ? 2.5 : 2;
      ctx.shadowColor = brushColorRef.current;
      ctx.shadowBlur = 10;
      ctx.stroke();

      // outer pulse ring
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cr + 8, 0, Math.PI * 2);
      ctx.strokeStyle = brushColorRef.current;
      ctx.lineWidth = 1;
      ctx.globalAlpha = drawing ? 0.7 : 0.3;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, []); // stable — reads only refs

  function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const pts = stroke.points;
    if (pts.length === 0) return;

    ctx.save();

    if (stroke.type === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.size * 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pts.length === 1) {
      ctx.fillStyle = stroke.color;
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.size * 1.5;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (stroke.type === "rainbow") {
      for (let i = 0; i < pts.length - 1; i++) {
        const hue = (i * 8) % 360;
        const c = `hsl(${hue}, 100%, 62%)`;
        ctx.beginPath();
        ctx.strokeStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = stroke.size * 1.8;
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
    } else if (stroke.type === "sparkle") {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        ctx.fillStyle = stroke.color;
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
        if (i % 2 === 0) {
          const r = stroke.size + 5;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y);
          ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r);
          ctx.stroke();
        }
      }
    } else if (stroke.type === "neon") {
      // Double-pass for glow
      ctx.strokeStyle = stroke.color;
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.size * 3;
      ctx.lineWidth = stroke.size * 1.2;
      drawSmoothPath(ctx, pts);

      ctx.strokeStyle = "#ffffff";
      ctx.shadowBlur = stroke.size * 0.6;
      ctx.lineWidth = stroke.size * 0.4;
      drawSmoothPath(ctx, pts);
    } else if (stroke.type === "laser") {
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.size * 4;
      ctx.lineWidth = stroke.size;
      drawSmoothPath(ctx, pts);

      ctx.strokeStyle = stroke.color;
      ctx.shadowBlur = stroke.size * 8;
      ctx.lineWidth = stroke.size * 0.4;
      drawSmoothPath(ctx, pts);
    } else {
      ctx.strokeStyle = stroke.color;
      drawSmoothPath(ctx, pts);
    }

    ctx.restore();
  }

  function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  // Start the render loop on mount, stop on unmount
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [renderFrame]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleClear = () => {
    strokesRef.current = [];
    currentPtsRef.current = [];
    setStrokeCount(0);
  };

  const handleUndo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exp = document.createElement("canvas");
    exp.width = canvas.width; exp.height = canvas.height;
    const ectx = exp.getContext("2d");
    if (!ectx) return;
    ectx.fillStyle = "#0a0d14";
    ectx.fillRect(0, 0, exp.width, exp.height);
    ectx.drawImage(canvas, 0, 0);
    const a = document.createElement("a");
    a.download = `VisionHand-Art-${Date.now()}.png`;
    a.href = exp.toDataURL("image/png");
    a.click();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between">
      {/* Top Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border z-20 shadow-lg">

        {/* Brush Type */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {([
            { type: "neon" as BrushType,    label: "Neon",    icon: <Zap className="w-3.5 h-3.5" />,      active: "bg-cyan-500 text-slate-950" },
            { type: "rainbow" as BrushType, label: "Rainbow", icon: <Sparkles className="w-3.5 h-3.5" />, active: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white" },
            { type: "sparkle" as BrushType, label: "Sparkle", icon: <Star className="w-3.5 h-3.5" />,     active: "bg-yellow-400 text-slate-950" },
            { type: "laser" as BrushType,   label: "Laser",   icon: <Zap className="w-3.5 h-3.5" />,      active: "bg-red-500 text-white" },
            { type: "eraser" as BrushType,  label: "Eraser",  icon: <Eraser className="w-3.5 h-3.5" />,   active: "bg-slate-600 text-white" },
          ]).map((b) => (
            <button
              key={b.type}
              onClick={() => setBrushType(b.type)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                brushType === b.type ? b.active + " shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              {b.icon}<span>{b.label}</span>
            </button>
          ))}
        </div>

        {/* Color palette */}
        {brushType !== "rainbow" && brushType !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setBrushColor(color)}
                className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                  brushColor === color ? "scale-125 ring-2 ring-white" : "hover:scale-110 opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              >
                {brushColor === color && <Check className="w-3 h-3 text-black" />}
              </button>
            ))}
          </div>
        )}

        {/* Size slider */}
        <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <Brush className="w-4 h-4 text-cyan-400" />
          <input
            type="range" min="2" max="32" value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 accent-cyan-400 cursor-pointer"
          />
          <span className="text-xs font-mono text-cyan-300 w-6">{brushSize}px</span>
        </div>

        {/* BG selector */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          {(["dark", "grid", "stars"] as BackgroundType[]).map((b) => (
            <button key={b} onClick={() => setBgType(b)}
              className={`px-2 py-1 text-[11px] font-mono rounded capitalize ${bgType === b ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
            >{b}</button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleUndo} disabled={strokeCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition-all border border-slate-700">
            <Undo2 className="w-3.5 h-3.5" /><span>Undo</span>
          </button>
          <button onClick={handleClear} disabled={strokeCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg transition-all shadow-md shadow-red-600/30">
            <Trash2 className="w-3.5 h-3.5" /><span>Clear</span>
          </button>
          <button onClick={handleExport} disabled={strokeCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /><span>Export PNG</span>
          </button>
        </div>
      </div>

      {/* Canvas Stage */}
      <div className="relative w-full flex-1 my-3 bg-slate-950/85 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />

        {/* Status pill */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-md pointer-events-none">
          <div className={`w-2.5 h-2.5 rounded-full ${isDrawing ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <span className="text-xs font-mono font-medium text-slate-200">
            {isDrawing ? `DRAWING · ${brushType.toUpperCase()}` : "HOVER (Open Palm = lift pen)"}
          </span>
        </div>

        {/* Tip */}
        {showHelper && (
          <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-cyan-500/30 text-xs text-slate-300 flex items-start gap-2.5 shadow-xl pointer-events-none">
            <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-cyan-300">Air Drawing — How to use:</p>
              <p className="mt-1">
                • <strong className="text-white">Pinch or Point finger</strong> to draw smooth strokes<br />
                • <strong className="text-white">Open Palm</strong> lifts pen (repositions without drawing)
              </p>
            </div>
            <button onClick={() => setShowHelper(false)} className="pointer-events-auto text-slate-400 hover:text-white px-1">✕</button>
          </div>
        )}
      </div>
    </div>
  );
};
