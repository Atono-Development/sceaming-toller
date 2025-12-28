import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { getTeamGames } from "../../lib/api";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useTeamContext } from "../../contexts/TeamContext";
import {
  getAttendance,
  updateAttendance,
  type Attendance,
} from "../../api/games";
import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect } from "react";
import { utcToLocalDate, getTodayAtMidnight } from "../../utils/dateUtils";

export function GamesPage() {
  const { teamId } = useParams();
  const { currentTeam } = useTeamContext();
  const { user } = useAuth();
  const [attendanceStates, setAttendanceStates] = useState<
    Record<string, Attendance | null>
  >({});

  const { data: games, isLoading } = useQuery({
    queryKey: ["team-games", teamId],
    queryFn: () => getTeamGames(teamId!),
    enabled: !!teamId,
  });

  const fetchAttendanceForGame = async (gameId: string) => {
    try {
      const attendanceData = await getAttendance(teamId!, gameId);
      const myAttendance = attendanceData.find(
        (a) => a.teamMember?.user?.email === user?.email
      );
      setAttendanceStates((prev) => ({
        ...prev,
        [gameId]: myAttendance || null,
      }));
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    }
  };

  const handleAttendanceChange = async (gameId: string, status: string) => {
    try {
      await updateAttendance(teamId!, gameId, status);
      setAttendanceStates((prev) => ({
        ...prev,
        [gameId]: {
          id: "",
          teamMemberId: "",
          gameId,
          status,
          updatedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error("Failed to update attendance:", error);
    }
  };

  useEffect(() => {
    if (games) {
      games.forEach((game: any) => {
        fetchAttendanceForGame(game.id);
      });
    }
  }, [games]);

  if (isLoading) return <div>Loading schedule...</div>;

  // Sort games: upcoming first, then past
  const now = getTodayAtMidnight();

  const upcomingGames = games
    ?.filter((game: any) => {
      const localGameDate = utcToLocalDate(game.date);
      return localGameDate >= now;
    })
    .sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  const pastGames = games
    ?.filter((game: any) => {
      const localGameDate = utcToLocalDate(game.date);
      return localGameDate < now;
    })
    .sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    ); // Most recent past games first;

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        {currentTeam?.membership?.role === "admin" && (
          <Button asChild>
            <Link to={`/teams/${teamId}/games/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Game
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {/* Upcoming Games Section */}
        {upcomingGames && upcomingGames.length > 0 && (
          <>
            <div className="text-lg font-semibold text-slate-700 mt-4">
              Upcoming Games
            </div>
            {upcomingGames.map((game: any) => (
              <Card key={game.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-semibold">
                    vs {game.opposingTeam}
                  </CardTitle>
                  <div className="text-sm font-medium text-muted-foreground">
                    {format(utcToLocalDate(game.date), "MMM d, yyyy")} •{" "}
                    {game.time}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Location: {game.location}
                  </div>
                  <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {game.status}
                  </div>

                  {/* Attendance Section */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 mb-2">
                      Your attendance:
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "going"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "going"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                        }`}
                        onClick={() => handleAttendanceChange(game.id, "going")}
                      >
                        Going
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "maybe"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "maybe"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : ""
                        }`}
                        onClick={() => handleAttendanceChange(game.id, "maybe")}
                      >
                        Maybe
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "not_going"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "not_going"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : ""
                        }`}
                        onClick={() =>
                          handleAttendanceChange(game.id, "not_going")
                        }
                      >
                        Not Going
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* Past Games Section */}
        {pastGames && pastGames.length > 0 && (
          <>
            <div className="text-lg font-semibold text-slate-500 mt-6">
              Past Games
            </div>
            {pastGames.map((game: any) => (
              <Card key={game.id} className="opacity-75">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-semibold">
                    vs {game.opposingTeam}
                  </CardTitle>
                  <div className="text-sm font-medium text-muted-foreground">
                    {format(utcToLocalDate(game.date), "MMM d, yyyy")} •{" "}
                    {game.time}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Location: {game.location}
                  </div>
                  <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {game.status}
                  </div>

                  {/* Attendance Section - Read-only for past games */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 mb-2">
                      Your attendance:
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "going"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "going"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                        }`}
                        disabled
                      >
                        Going
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "maybe"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "maybe"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : ""
                        }`}
                        disabled
                      >
                        Maybe
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          attendanceStates[game.id]?.status === "not_going"
                            ? "default"
                            : "outline"
                        }
                        className={`flex-1 ${
                          attendanceStates[game.id]?.status === "not_going"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : ""
                        }`}
                        disabled
                      >
                        Not Going
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* No games message */}
        {(!upcomingGames || upcomingGames.length === 0) &&
          (!pastGames || pastGames.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              No games scheduled yet.
            </div>
          )}
      </div>
    </div>
  );
}
