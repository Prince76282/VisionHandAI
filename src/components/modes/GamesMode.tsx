import React, { useState } from "react";
import type { GameType } from "../../types/vision";
import { BalloonPopGame } from "./games/BalloonPopGame";
import { RockPaperScissorsGame } from "./games/RockPaperScissorsGame";
import { LaserSliceGame } from "./games/LaserSliceGame";
import { CarDriveGame } from "./games/CarDriveGame";
import { Gamepad2, Sparkles, Swords, Flame, Car } from "lucide-react";

export const GamesMode: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<GameType>("balloon_pop");

  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Game Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedGame("balloon_pop")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedGame === "balloon_pop"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Balloon Pop 2.0</span>
          </button>

          <button
            onClick={() => setSelectedGame("laser_slice")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedGame === "laser_slice"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Laser Blade Slicer</span>
          </button>

          <button
            onClick={() => setSelectedGame("car_drive")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedGame === "car_drive"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Car Driving 🏎️</span>
          </button>

          <button
            onClick={() => setSelectedGame("rock_paper_scissors")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedGame === "rock_paper_scissors"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Rock Paper Scissors</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
          <span>Neural Gesture Arcade Suite</span>
        </div>
      </div>

      {/* Selected Game Component */}
      <div className="flex-1 w-full min-h-[500px]">
        {selectedGame === "balloon_pop" && <BalloonPopGame />}
        {selectedGame === "laser_slice" && <LaserSliceGame />}
        {selectedGame === "car_drive" && <CarDriveGame />}
        {selectedGame === "rock_paper_scissors" && <RockPaperScissorsGame />}
      </div>
    </div>
  );
};
