import React from "react";
import { type BattingOrder, type Game } from "@/api/games";

interface Player {
  id: string;
  name: string;
  gender: "Male" | "Female";
  isPitcher: boolean;
}

interface PrintableLineupProps {
  game: Game | undefined;
  positionsByInning: Record<number, Record<string, string>>;
  battingOrder: BattingOrder[];
}

const PrintableLineup: React.FC<PrintableLineupProps> = ({
  game,
  positionsByInning,
  battingOrder,
}) => {
  if (!game) return null;

  // Use 7 innings instead of 9 for softball
  const totalInnings = 7;

  // Convert batting order to Player format
  const players: Player[] = battingOrder.map((player) => ({
    id: player.teamMemberId,
    name: player.teamMember?.user?.name || "Unknown Player",
    gender: player.teamMember?.gender === "M" ? "Male" : "Female",
    isPitcher:
      player.teamMember?.role
        .split(",")
        .map((role) => role.trim().toLowerCase())
        .includes("pitcher") || false,
  }));

  return (
    <div className="p-4 bg-white print:p-2 max-w-[8.5in] mx-auto">
      <div className="text-center mb-3 print:mb-2">
        <h1 className="text-2xl font-bold text-team-orange print:text-xl">
          Screaming Orange Tollers
        </h1>
        <h2 className="text-lg font-semibold print:text-base">
          vs. {game.opposingTeam}
        </h2>
        <p className="text-sm text-gray-600">
          {new Date(game.date).toLocaleDateString()} at {game.location}
        </p>
      </div>

      {/* Batting Order Section */}
      <div className="mb-4 print:mb-2">
        <h3 className="text-lg font-bold text-team-blue-dark border-b border-team-orange mb-2 print:text-base">
          Batting Order
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left w-8">#</th>
                <th className="border p-1 text-left">Player</th>
                <th className="border p-1 text-center">Gender</th>
                <th className="border p-1 text-center">Pitcher</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id}>
                  <td className="border p-1 font-medium text-center">
                    {index + 1}
                  </td>
                  <td className="border p-1">{player.name}</td>
                  <td className="border p-1 text-center">
                    {player.gender === "Male" ? "M" : "F"}
                  </td>
                  <td className="border p-1 text-center">
                    {player.isPitcher ? "✓" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fielding Positions Section */}
      <div className="mb-4 print:mb-2">
        <h3 className="text-lg font-bold text-team-blue-dark border-b border-team-orange mb-2 print:text-base">
          Fielding Positions by Inning
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">Player</th>
                {Array.from({ length: totalInnings }, (_, i) => (
                  <th key={i} className="border p-1 text-center">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="border p-1">{player.name}</td>
                  {Array.from({ length: totalInnings }, (_, i) => {
                    const inning = i + 1;
                    // Find this player's position in this inning
                    let position = "-";

                    // Use full name for matching instead of just first name
                    const playerName = player.name;

                    // Check if this player is explicitly assigned to a position in this inning
                    Object.entries(positionsByInning[inning] || {}).forEach(
                      ([pos, name]) => {
                        if (
                          name === playerName &&
                          pos !== "Bench" &&
                          !pos.startsWith("Batter")
                        ) {
                          position = pos;
                        }
                      }
                    );

                    // Check if this player is on the bench in this inning
                    const benchPlayers =
                      positionsByInning[inning]?.["Bench"]?.split(", ") || [];
                    if (benchPlayers.some((name) => name === playerName)) {
                      position = "Bench";
                    }

                    return (
                      <td
                        key={i}
                        className={`border p-1 text-center ${
                          position === "Bench" ? "bg-gray-100" : ""
                        }`}
                      >
                        {position}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score Tracker Section */}
      <div>
        <h3 className="text-lg font-bold text-team-blue-dark border-b border-team-orange mb-2 print:text-base">
          Score Tracker
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">Team</th>
                {Array.from({ length: totalInnings }, (_, i) => (
                  <th key={i} className="border p-1 text-center w-8">
                    {i + 1}
                  </th>
                ))}
                <th className="border p-1 text-center w-12">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-1 font-medium">
                  Screaming Orange Tollers
                </td>
                {Array.from({ length: totalInnings }, (_, i) => (
                  <td key={i} className="border p-1 text-center h-6">
                    {/* Empty cell for score entry */}
                  </td>
                ))}
                <td className="border p-1 text-center font-bold h-6">
                  {/* Empty cell for total score */}
                </td>
              </tr>
              <tr>
                <td className="border p-1 font-medium">{game.opposingTeam}</td>
                {Array.from({ length: totalInnings }, (_, i) => (
                  <td key={i} className="border p-1 text-center h-6">
                    {/* Empty cell for score entry */}
                  </td>
                ))}
                <td className="border p-1 text-center font-bold h-6">
                  {/* Empty cell for total score */}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-4 text-center print:mt-2 print:text-[8px]">
        <p>
          Generated on {new Date().toLocaleDateString()} | Screaming Orange
          Tollers Lineup System
        </p>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `,
        }}
      />
    </div>
  );
};

export default PrintableLineup;
