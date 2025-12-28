import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { TeamSelector } from "../components/TeamSelector";
import PlayerPreferencesForm from "../components/PlayerPreferencesForm";
import AttendanceManagement from "../components/AttendanceManagement";
import LineupViewing from "../components/LineupViewing";
import { getTeamGames, type Game } from "../api/games";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import { useToast } from "../hooks/use-toast";
import { utcToLocalDate, getTodayAtMidnight } from "../utils/dateUtils";

const PlayerDashboard: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentTeam: selectedTeam } = useTeamContext();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedTeam) {
      loadGames();
    } else {
      setGames([]);
      setSelectedGame(null);
      setLoading(false);
    }
  }, [selectedTeam]);

  const loadGames = async () => {
    if (!selectedTeam) return;

    setLoading(true);
    try {
      const data = await getTeamGames(selectedTeam.id);
      setGames(data);

      // Select the next upcoming game by default
      const now = getTodayAtMidnight();

      const upcomingGames = data.filter((game) => {
        const localGameDate = utcToLocalDate(game.date);
        return localGameDate >= now && game.status === "scheduled";
      });

      if (upcomingGames.length > 0) {
        setSelectedGame(upcomingGames[0]);
      } else if (data.length > 0) {
        setSelectedGame(data[0]);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatGameDate = (dateString: string) => {
    const localDate = utcToLocalDate(dateString);
    return localDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getGameStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500";
      case "in_progress":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!user) {
    return <div>Please log in to view your dashboard.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Player Dashboard</h1>
        <TeamSelector />
      </div>

      {!selectedTeam ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Please select a team to view your dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Preferences Section */}
          <PlayerPreferencesForm teamId={selectedTeam.id} />

          {/* Games Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Game Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div>Loading games...</div>
              ) : games.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No games scheduled for this team.
                </div>
              ) : (
                (() => {
                  const now = getTodayAtMidnight();

                  const upcomingGames = games
                    .filter((game: Game) => {
                      const localGameDate = utcToLocalDate(game.date);
                      return localGameDate >= now;
                    })
                    .sort(
                      (a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );

                  const pastGames = games
                    .filter((game: Game) => {
                      const localGameDate = utcToLocalDate(game.date);
                      return localGameDate < now;
                    })
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                  return (
                    <div className="space-y-4">
                      {upcomingGames.length > 0 && (
                        <>
                          <div className="text-lg font-semibold text-slate-700">
                            Upcoming Games
                          </div>
                          <div className="space-y-2">
                            {upcomingGames.map((game) => (
                              <div
                                key={game.id}
                                className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors hover:bg-muted/50 ${
                                  selectedGame?.id === game.id ? "bg-muted" : ""
                                }`}
                                onClick={() => setSelectedGame(game)}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-3 h-3 rounded-full ${getGameStatusColor(
                                      game.status
                                    )}`}
                                  ></div>
                                  <div>
                                    <div className="font-medium">
                                      {game.opposingTeam}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatGameDate(game.date)} at {game.time}{" "}
                                      • {game.location}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-medium text-blue-600">
                                  Upcoming
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {pastGames.length > 0 && (
                        <>
                          <div className="text-lg font-semibold text-slate-500 mt-6">
                            Past Games
                          </div>
                          <div className="space-y-2">
                            {pastGames.map((game) => (
                              <div
                                key={game.id}
                                className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors hover:bg-muted/50 opacity-75 ${
                                  selectedGame?.id === game.id ? "bg-muted" : ""
                                }`}
                                onClick={() => setSelectedGame(game)}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-3 h-3 rounded-full ${getGameStatusColor(
                                      game.status
                                    )}`}
                                  ></div>
                                  <div>
                                    <div className="font-medium">
                                      {game.opposingTeam}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatGameDate(game.date)} at {game.time}{" "}
                                      • {game.location}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Past
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Selected Game Details */}
          {selectedGame && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttendanceManagement
                teamId={selectedTeam.id}
                game={selectedGame}
              />
              <LineupViewing teamId={selectedTeam.id} game={selectedGame} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PlayerDashboard;
