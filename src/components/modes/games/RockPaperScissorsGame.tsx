import React, { useState, useEffect, useRef } from "react";
import { gestureBus } from "../../../services/eventBus";
import type { GestureEvent, GestureType } from "../../../types/vision";
import { Trophy, Swords, RotateCcw, Play } from "lucide-react";
import confetti from "canvas-confetti";

type RPSMove = "ROCK" | "PAPER" | "SCISSORS";

interface RoundResult {
  round: number;
  playerMove: RPSMove | "UNKNOWN";
  aiMove: RPSMove;
  outcome: "WIN" | "LOSE" | "TIE";
  playerGesture: GestureType;
}

const RPS_EMOJIS: Record<RPSMove, string> = {
  ROCK: "✊",
  PAPER: "✋",
  SCISSORS: "✌️",
};

const RPS_NAMES: Record<RPSMove, string> = {
  ROCK: "Rock (Fist)",
  PAPER: "Paper (Open Palm)",
  SCISSORS: "Scissors (Peace)",
};

export const RockPaperScissorsGame: React.FC = () => {
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number>(0);
  const [ties, setTies] = useState<number>(0);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);

  const [roundState, setRoundState] = useState<"IDLE" | "COUNTDOWN" | "SHOWDOWN">("IDLE");
  const [countdown, setCountdown] = useState<number>(3);
  const [currentAiMove, setCurrentAiMove] = useState<RPSMove | null>(null);
  const [latestRound, setLatestRound] = useState<RoundResult | null>(null);

  const [liveGesture, setLiveGesture] = useState<GestureType>("NONE");
  const latestGestureRef = useRef<{ gesture: GestureType; conf: number }>({ gesture: "NONE", conf: 0 });

  const mapGestureToRPS = (gesture: GestureType): RPSMove | "UNKNOWN" => {
    switch (gesture) {
      case "FIST":
        return "ROCK";
      case "OPEN_PALM":
        return "PAPER";
      case "PEACE_SIGN":
        return "SCISSORS";
      default:
        return "UNKNOWN";
    }
  };

  useEffect(() => {
    const unsub = gestureBus.subscribe((event: GestureEvent) => {
      setLiveGesture(event.event);
      latestGestureRef.current = {
        gesture: event.event,
        conf: event.confidence,
      };
    });
    return unsub;
  }, []);

  const playRound = () => {
    if (roundState === "COUNTDOWN") return;
    setRoundState("COUNTDOWN");
    setCountdown(3);
    setCurrentAiMove(null);
    setLatestRound(null);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(interval);
        resolveShowdown();
      }
    }, 900);
  };

  const resolveShowdown = () => {
    const moves: RPSMove[] = ["ROCK", "PAPER", "SCISSORS"];
    const aiMove = moves[Math.floor(Math.random() * moves.length)];
    setCurrentAiMove(aiMove);

    const playerGesture = latestGestureRef.current.gesture;
    const playerMove = mapGestureToRPS(playerGesture);

    let outcome: "WIN" | "LOSE" | "TIE" = "TIE";

    if (playerMove === "UNKNOWN") {
      outcome = "LOSE";
    } else if (playerMove === aiMove) {
      outcome = "TIE";
      setTies((t) => t + 1);
    } else if (
      (playerMove === "ROCK" && aiMove === "SCISSORS") ||
      (playerMove === "PAPER" && aiMove === "ROCK") ||
      (playerMove === "SCISSORS" && aiMove === "PAPER")
    ) {
      outcome = "WIN";
      setPlayerScore((s) => s + 1);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      outcome = "LOSE";
      setAiScore((s) => s + 1);
    }

    const roundRes: RoundResult = {
      round: roundHistory.length + 1,
      playerMove,
      aiMove,
      outcome,
      playerGesture,
    };

    setLatestRound(roundRes);
    setRoundHistory((prev) => [roundRes, ...prev].slice(0, 8));
    setRoundState("SHOWDOWN");
  };

  const resetGame = () => {
    setPlayerScore(0);
    setAiScore(0);
    setTies(0);
    setRoundHistory([]);
    setRoundState("IDLE");
    setCurrentAiMove(null);
    setLatestRound(null);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between items-center select-none">
      {/* Top Header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-cyber-card/90 backdrop-blur-md rounded-xl border border-cyber-border z-10 shadow-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Trophy className="w-4 h-4 text-cyan-400" />
            <span>You: <strong className="text-white text-base">{playerScore}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-pink-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Swords className="w-4 h-4 text-pink-400" />
            <span>AI Bot: <strong className="text-white text-base">{aiScore}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>Ties: <strong className="text-white text-base">{ties}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={playRound}
            disabled={roundState === "COUNTDOWN"}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{roundState === "COUNTDOWN" ? "Showdown in progress..." : "Start Round"}</span>
          </button>

          <button
            onClick={resetGame}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg shadow-red-600/30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Hand Gesture Suggestion Guide */}
      <div className="w-full mt-2 px-3.5 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
            💡 HAND GUIDE
          </span>
          <span>✊ Fist = Rock • ✋ Open Palm = Paper • ✌️ Peace = Scissors</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Your Hand:</span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
            {liveGesture} ({mapGestureToRPS(liveGesture)})
          </span>
        </div>
      </div>

      {/* Main Showdown Arena */}
      <div className="relative w-full flex-1 my-2 bg-slate-950/85 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl flex flex-col items-center justify-center p-6 min-h-[480px]">
        {roundState === "IDLE" && !latestRound && (
          <div className="flex flex-col items-center justify-center text-center max-w-md">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4 shadow-glow">
              <Swords className="w-12 h-12 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-wide">ROCK PAPER SCISSORS AI</h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Show your hand gesture to the webcam during the 3-second countdown to battle against the neural AI opponent!
            </p>
            <button
              onClick={playRound}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 text-sm uppercase tracking-wider flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Round 1</span>
            </button>
          </div>
        )}

        {roundState === "COUNTDOWN" && (
          <div className="flex flex-col items-center justify-center text-center animate-in zoom-in">
            <div className="text-8xl font-black text-cyan-400 font-mono mb-4 animate-bounce">
              {countdown}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Show Your Hand Move!</h3>
            <div className="flex items-center gap-3 p-3 bg-slate-900/90 rounded-xl border border-cyan-500/40">
              <span className="text-sm text-slate-300">Current Gesture:</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {liveGesture} ({mapGestureToRPS(liveGesture)})
              </span>
            </div>
          </div>
        )}

        {roundState === "SHOWDOWN" && latestRound && (
          <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-black mb-6">
              {latestRound.outcome === "WIN" && <span className="text-emerald-400 text-4xl">🎉 YOU WON!</span>}
              {latestRound.outcome === "LOSE" && <span className="text-red-400 text-4xl">💀 AI BOT WON!</span>}
              {latestRound.outcome === "TIE" && <span className="text-amber-400 text-4xl">🤝 IT'S A TIE!</span>}
            </div>

            <div className="grid grid-cols-2 gap-8 w-full max-w-lg mb-8">
              {/* Player side */}
              <div className="flex flex-col items-center p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/40">
                <span className="text-xs font-mono text-cyan-400 uppercase font-bold mb-2">You Played</span>
                <div className="text-6xl mb-2">
                  {latestRound.playerMove !== "UNKNOWN" ? RPS_EMOJIS[latestRound.playerMove] : "❓"}
                </div>
                <span className="text-sm font-bold text-white">
                  {latestRound.playerMove !== "UNKNOWN" ? RPS_NAMES[latestRound.playerMove] : "No Gesture Detected"}
                </span>
              </div>

              {/* AI side */}
              <div className="flex flex-col items-center p-5 rounded-2xl bg-slate-900/80 border border-pink-500/40">
                <span className="text-xs font-mono text-pink-400 uppercase font-bold mb-2">AI Played</span>
                <div className="text-6xl mb-2">{currentAiMove ? RPS_EMOJIS[currentAiMove] : "🤖"}</div>
                <span className="text-sm font-bold text-white">
                  {currentAiMove ? RPS_NAMES[currentAiMove] : "..."}
                </span>
              </div>
            </div>

            <button
              onClick={playRound}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 text-sm uppercase tracking-wider flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Next Round</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
