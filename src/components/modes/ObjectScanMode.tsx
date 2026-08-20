import React, { useRef, useState, useCallback, useEffect } from "react";
import { useCamera } from "../../hooks/useCamera";
import { apiKeyStore } from "../../services/apiKeyStore";
import { detectObjectsInImage, captureVideoFrame } from "../../services/openRouterService";
import type { ObjectDetectionResult, DetectedObject } from "../../types/vision";
import {
  Eye,
  Key,
  Camera,
  Upload,
  Scan,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Electronics: "from-cyan-500 to-blue-500",
  Stationery: "from-violet-500 to-purple-500",
  Food: "from-orange-400 to-amber-400",
  Person: "from-pink-500 to-rose-500",
  Furniture: "from-teal-500 to-emerald-500",
  Nature: "from-green-500 to-lime-500",
  Vehicle: "from-sky-500 to-indigo-500",
  Other: "from-slate-400 to-slate-500",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  Electronics: "📱",
  Stationery: "✏️",
  Food: "🍎",
  Person: "👤",
  Furniture: "🪑",
  Nature: "🌿",
  Vehicle: "🚗",
  Other: "📦",
};

// ─── API Key Setup Panel ─────────────────────────────────────────────────────

const ApiKeyPanel: React.FC<{ onKeySet: (key: string) => void }> = ({ onKeySet }) => {
  const [inputKey, setInputKey] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed || !trimmed.startsWith("sk-")) {
      setError("Please enter a valid OpenRouter API key (starts with sk-)");
      return;
    }
    apiKeyStore.set(trimmed);
    onKeySet(trimmed);
    setError("");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md w-full space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg">
            <Key className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-xl font-extrabold text-foreground mb-1">Connect to OpenRouter AI</h2>
          <p className="text-sm text-muted-foreground">
            Enter your OpenRouter API key to enable AI-powered object detection using{" "}
            <span className="text-cyan-400 font-semibold">GPT-4o mini</span>. Your key is saved locally in your browser — never sent to any server.
          </p>
        </div>

        {/* Key Input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => { setInputKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder-muted-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Save Key & Start Scanning
          </button>
        </div>

        {/* Get Key Link */}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
        >
          <ExternalLink className="w-3 h-3" />
          Get a free OpenRouter API key at openrouter.ai
        </a>
      </div>
    </div>
  );
};

// ─── Object Card ─────────────────────────────────────────────────────────────

const ObjectCard: React.FC<{ obj: DetectedObject; index: number }> = ({ obj, index }) => {
  const category = obj.category ?? "Other";
  const gradientClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Other"];
  const emoji = CATEGORY_EMOJIS[category] ?? "📦";
  const pct = Math.round(obj.confidence * 100);

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent/40 transition-all animate-in slide-in-from-left duration-300"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Rank + Category emoji */}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0 text-lg shadow-sm`}>
        {emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-bold text-sm text-foreground truncate">{obj.label}</span>
          <span className={`text-xs font-mono font-bold flex-shrink-0 ${pct >= 85 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>
            {pct}%
          </span>
        </div>

        {/* Confidence bar */}
        <div className="h-1.5 rounded-full bg-border mb-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {obj.description && (
          <p className="text-[11px] text-muted-foreground leading-tight">{obj.description}</p>
        )}

        {obj.category && (
          <span className="inline-block mt-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
            {obj.category}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Scan History Row ─────────────────────────────────────────────────────────

const HistoryRow: React.FC<{
  result: ObjectDetectionResult;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ result, onSelect, isSelected }) => {
  const timeStr = new Date(result.timestamp).toLocaleTimeString();
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
        isSelected
          ? "bg-accent/10 border-accent/40 text-accent"
          : "bg-surface border-border hover:border-accent/30 text-muted-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground truncate">
          {result.imageSource === "webcam" ? "📸" : "🖼️"} {result.objects.slice(0, 3).map((o) => o.label).join(", ")}
          {result.objects.length > 3 ? ` +${result.objects.length - 3}` : ""}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0 text-[10px]">
          <Clock className="w-3 h-3" />
          {timeStr}
        </span>
      </div>
    </button>
  );
};

// ─── Main ObjectScanMode ──────────────────────────────────────────────────────

export const ObjectScanMode: React.FC = () => {
  const { videoRef, isActive, isLoading, toggleCamera } = useCamera();

  const [apiKey, setApiKey] = useState<string | null>(() => apiKeyStore.get());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Auto-Scan Live Stream States
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);
  const [autoScanCountdown, setAutoScanCountdown] = useState<number>(4);

  const [currentResult, setCurrentResult] = useState<ObjectDetectionResult | null>(null);
  const [history, setHistory] = useState<ObjectDetectionResult[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);
  isScanningRef.current = isScanning;

  // ─── Webcam Snap & Analyze ──────────────────────────────────────────────────

  const handleWebcamScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !apiKey || isScanningRef.current) return;

    setScanError(null);
    setIsScanning(true);
    setUploadedImage(null);

    try {
      const frameDataUrl = captureVideoFrame(video);
      const result = await detectObjectsInImage(frameDataUrl, apiKey, "webcam");
      setCurrentResult(result);
      setHistory((h) => [result, ...h].slice(0, 8));
    } catch (err: any) {
      setScanError(err.message ?? "Object detection failed. Check your API key and try again.");
    } finally {
      setIsScanning(false);
    }
  }, [videoRef, apiKey]);

  // ─── Auto-Scan Live Loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoScanEnabled || !isActive || !apiKey) return;

    let countdown = 4;
    setAutoScanCountdown(4);

    const interval = setInterval(() => {
      countdown -= 1;
      setAutoScanCountdown(countdown);

      if (countdown <= 0) {
        countdown = 4;
        setAutoScanCountdown(4);
        if (!isScanningRef.current && isActive && videoRef.current) {
          handleWebcamScan();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoScanEnabled, isActive, apiKey, handleWebcamScan, videoRef]);

  // ─── Image Upload & Analyze ─────────────────────────────────────────────────

  const processImageFile = useCallback(
    async (file: File) => {
      if (!apiKey) return;
      if (!file.type.startsWith("image/")) {
        setScanError("Please upload an image file (JPEG, PNG, WEBP).");
        return;
      }

      setScanError(null);
      setIsScanning(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImage(dataUrl);
        setUploadedFileName(file.name);

        try {
          const result = await detectObjectsInImage(dataUrl, apiKey, "upload");
          setCurrentResult(result);
          setHistory((h) => [result, ...h].slice(0, 8));
        } catch (err: any) {
          setScanError(err.message ?? "Analysis failed. Check your API key.");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [apiKey]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  if (!apiKey) {
    return <ApiKeyPanel onKeySet={setApiKey} />;
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-foreground">AI Live Object Scanner</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              GPT-4o mini
            </span>
          </div>

          {/* Auto-Scan Toggle */}
          <button
            onClick={() => setAutoScanEnabled((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              autoScanEnabled
                ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 ring-2 ring-blue-400/50"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoScanEnabled ? "text-yellow-300 fill-current animate-pulse" : ""}`} />
            <span>{autoScanEnabled ? `Auto-Scan: ON (${autoScanCountdown}s)` : "Enable Auto-Scan"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* API Key Reset */}
          <button
            onClick={() => { apiKeyStore.clear(); setApiKey(null); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-border border border-border text-muted-foreground hover:text-foreground transition-all text-xs"
            title="Reset API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Key</span>
          </button>

          {/* History Toggle */}
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
              showHistory
                ? "bg-blue-600/20 border-blue-400 text-blue-400"
                : "bg-surface border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History ({history.length})</span>
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Scan History Dropdown */}
      {showHistory && history.length > 0 && (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface/80 border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Scan History</span>
          {history.map((r) => (
            <HistoryRow
              key={r.timestamp}
              result={r}
              isSelected={currentResult?.timestamp === r.timestamp}
              onSelect={() => { setCurrentResult(r); setShowHistory(false); }}
            />
          ))}
        </div>
      )}

      {/* Main 2-Col Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">

        {/* ── Left: Image Source Panel ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          {/* Webcam Feed Panel */}
          <div className="flex-1 rounded-2xl overflow-hidden bg-surface-deep border border-border relative flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-400" /> Live Webcam Feed
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ade80]" : "bg-slate-600"}`} />
                <button
                  onClick={toggleCamera}
                  disabled={isLoading}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-md ${
                    isActive
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                  }`}
                >
                  {isLoading ? "..." : isActive ? "Stop Camera" : "Start Camera"}
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[260px] bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef as any}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover transition-opacity duration-300 -scale-x-100 ${isActive ? "opacity-100" : "opacity-0"}`}
              />
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Camera className="w-10 h-10 opacity-30" />
                  <span className="text-xs">Camera is currently standby</span>
                </div>
              )}

              {/* Auto-Scan Active Pulse Indicator */}
              {autoScanEnabled && isActive && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 bg-slate-950/85 backdrop-blur-md rounded-full border border-blue-500/40 text-blue-300 text-xs font-mono shadow-lg">
                  <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
                  <span>Auto-scan active in {autoScanCountdown}s</span>
                </div>
              )}
            </div>

            {/* Snap & Analyze Button (Blue) */}
            <div className="p-3 border-t border-border">
              <button
                onClick={handleWebcamScan}
                disabled={!isActive || isScanning}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                {isScanning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> AI Analyzing Scene...</>
                ) : (
                  <><Scan className="w-4 h-4" /> Snap & Analyze Frame</>
                )}
              </button>
            </div>
          </div>

          {/* Image Upload Panel */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
              isDragging
                ? "border-blue-400 bg-blue-500/10 scale-[1.01]"
                : "border-border hover:border-blue-400/50 bg-surface"
            }`}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {uploadedImage ? (
              /* Uploaded Image Preview — large and clear */
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Uploaded for analysis"
                  className="w-full max-h-80 object-contain bg-slate-950"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-950/90 text-slate-300 border border-slate-700 max-w-[160px] truncate">
                    {uploadedFileName}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedImage(null); setCurrentResult(null); }}
                    className="p-1 rounded-lg bg-slate-950/90 text-slate-400 hover:text-red-400 border border-slate-700 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2.5 bg-surface border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Click to upload different image
                  </span>
                  <button
                    disabled={isScanning}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (uploadedImage && apiKey) {
                        setIsScanning(true);
                        detectObjectsInImage(uploadedImage, apiKey, "upload")
                          .then((r) => {
                            setCurrentResult(r);
                            setHistory((h) => [r, ...h].slice(0, 8));
                          })
                          .catch((err) => setScanError(err.message))
                          .finally(() => setIsScanning(false));
                      }
                    }}
                    className="text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
                    Re-Analyze
                  </button>
                </div>
              </div>
            ) : (
              /* Drop Zone */
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Upload Image to Identify Everything</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click to browse — JPEG, PNG, WEBP</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Results Panel ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Error Banner */}
          {scanError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">Detection Failed</div>
                <div className="text-red-300/80">{scanError}</div>
              </div>
              <button onClick={() => setScanError(null)} className="ml-auto flex-shrink-0 hover:text-red-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              Detected Objects
              {currentResult && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {currentResult.objects.length} found
                </span>
              )}
            </h3>

            {currentResult && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(currentResult.timestamp).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => { setCurrentResult(null); setScanError(null); setUploadedImage(null); }}
                  className="p-1 rounded-lg hover:bg-border text-muted-foreground hover:text-foreground transition-all"
                  title="Clear results"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Results Body */}
          <div className="flex-1 overflow-y-auto rounded-2xl bg-surface border border-border">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center h-full p-8 gap-4 min-h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">Analyzing Image with GPT-4o mini...</p>
                  <p className="text-xs text-muted-foreground mt-1">Identifying every object, pen, phone, tool in view</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : currentResult && currentResult.objects.length > 0 ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-300 font-semibold">
                    {currentResult.imageSource === "webcam" ? "Webcam snapshot" : "Uploaded image"} analyzed — {currentResult.objects.length} objects identified
                  </span>
                </div>

                {currentResult.objects.map((obj, i) => (
                  <ObjectCard key={`${obj.label}-${i}`} obj={obj} index={i} />
                ))}
              </div>
            ) : currentResult && currentResult.objects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3 min-h-[300px]">
                <Eye className="w-10 h-10 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No objects could be identified in this frame. Try pointing camera closer.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3 text-muted-foreground min-h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-surface-deep border border-border flex items-center justify-center">
                  <Scan className="w-8 h-8 opacity-30" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Ready to Scan</p>
                  <p className="text-xs mt-1 max-w-xs">
                    Hold any object in front of the webcam (pen, pencil, phone, cup) and click <strong className="text-blue-400">Snap & Analyze</strong>, or enable <strong className="text-blue-400">Auto-Scan</strong>!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
