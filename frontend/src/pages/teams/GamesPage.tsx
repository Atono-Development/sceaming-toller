import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Plus, Edit, Trash2, Trophy } from "lucide-react";
import { format } from "date-fns";
import { getTeamGames } from "../../lib/api";
import {
  deleteGame,
  getAttendance,
  updateAttendance,
  type Attendance,
} from "../../api/games";
import { getMyTeamMemberInfo } from "../../api/members";
import { Button } from "../../components/ui/button";
import { useToast } from "../../hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { useTeamContext } from "../../contexts/TeamContext";
import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect } from "react";
import { utcToLocalDate, getTodayAtMidnight } from "../../utils/dateUtils";

export function GamesPage() {
  const { teamId } = useParams();
  const { currentTeam } = useTeamContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [attendanceStates, setAttendanceStates] = useState<
    Record<string, Attendance | null>
  >({});
  const [gameAttendance, setGameAttendance] = useState<
    Record<string, Attendance[]>
  >({});
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>(
    {}
  );
  const [gender, setGender] = useState<string | null>(null);
  const { toast } = useToast();

  const deleteGameMutation = useMutation({
    mutationFn: (gameId: string) => deleteGame(teamId!, gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-games", teamId] });
    },
    onError: () => {
      console.error("Failed to delete game");
    },
  });

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
      setGameAttendance((prev) => ({
        ...prev,
        [gameId]: attendanceData,
      }));
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    }
  };

  const handleAttendanceChange = async (gameId: string, status: string) => {
    if (!gender && gender !== null) {
      toast({
        title: "Gender Required",
        description: "Please set your gender in your profile before confirming attendance. This is required for creating balanced lineups.",
        variant: "destructive",
      });
      return;
    }
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
      // Refresh attendance data for this game
      fetchAttendanceForGame(gameId);
    } catch (error) {
      console.error("Failed to update attendance:", error);
    }
  };

  const toggleGameExpansion = (gameId: string) => {
    setExpandedGames((prev) => ({
      ...prev,
      [gameId]: !prev[gameId],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "going":
        return "bg-green-600";
      case "maybe":
        return "bg-yellow-500";
      case "not_going":
        return "bg-red-600";
      default:
        return "bg-slate-500";
    }
  };
  const handleDeleteGame = async (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this game?")) {
      deleteGameMutation.mutate(gameId);
    }
  };

  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (teamId && user) {
        try {
          const memberInfo = await getMyTeamMemberInfo(teamId);
          setGender(memberInfo.gender || "");
        } catch (error) {
          console.error("Failed to fetch member info:", error);
        }
      }
    };
    fetchMemberInfo();
  }, [teamId, user]);

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
    <div className="py-4 sm:py-8 space-y-6 px-2 sm:px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-4 border-black pb-4 mb-4">
        <h1 className="text-4xl font-black uppercase tracking-tighter">Schedule</h1>
        {currentTeam?.membership?.isAdmin && (
          <Button asChild variant="brutalist-orange" className="w-full sm:w-auto">
            <Link to={`/teams/${teamId}/games/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Game
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 min-w-0 w-full">
        {/* Upcoming Games Section */}
        {upcomingGames && upcomingGames.length > 0 && (
          <>
            <div className="text-xl font-black uppercase tracking-widest text-black mt-8 mb-2">
              Upcoming Games
            </div>
            {upcomingGames.map((game: any) => (
              <Card key={game.id} className="overflow-visible">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 p-4 sm:p-6 pb-2">
                  <CardTitle className="text-xl font-semibold break-words">
                    vs {game.opposingTeam}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {format(utcToLocalDate(game.date), "MMM d, yyyy")} •{" "}
                      {game.time}
                    </div>
                    {currentTeam?.membership?.isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="outline" asChild>
                          <Link to={`/teams/${teamId}/games/${game.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to={`/teams/${teamId}/games/${game.id}/score`}>
                            <Trophy className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteGame(game.id)}
                          disabled={deleteGameMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-sm text-muted-foreground">
                    Location: {game.location}
                  </div>

                  {/* Team Attendance List */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {expandedGames[game.id]
                      ? gameAttendance[game.id]?.map((att) => (
                          <Badge
                            key={att.id}
                            size="sm"
                            className={`${getStatusColor(
                              att.status
                            )} text-white`}
                          >
                            {att.teamMember?.user?.name || "Unknown"}
                          </Badge>
                        ))
                      : gameAttendance[game.id]?.slice(0, 3).map((att) => (
                          <Badge
                            key={att.id}
                            size="sm"
                            className={`${getStatusColor(
                              att.status
                            )} text-white`}
                          >
                            {att.teamMember?.user?.name || "Unknown"}
                          </Badge>
                        ))}
                    {gameAttendance[game.id] &&
                      gameAttendance[game.id].length > 3 && (
                        <button
                          onClick={() => toggleGameExpansion(game.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                        >
                          {expandedGames[game.id]
                            ? "Show less"
                            : `+${gameAttendance[game.id].length - 3} more`}
                        </button>
                      )}
                  </div>

                  {/* Score Display */}
                  {game.finalScore !== undefined &&
                    game.opponentScore !== undefined && (
                      <div className="mt-2 text-lg font-semibold">
                        {game.finalScore} - {game.opponentScore}
                        {game.finalScore > game.opponentScore && (
                          <span className="ml-2 text-green-600">Win</span>
                        )}
                        {game.finalScore < game.opponentScore && (
                          <span className="ml-2 text-red-600">Loss</span>
                        )}
                        {game.finalScore === game.opponentScore && (
                          <span className="ml-2 text-yellow-600">Tie</span>
                        )}
                      </div>
                    )}

                  {/* Attendance Section */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 mb-2">
                      Your attendance:
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant={
                          attendanceStates[game.id]?.status === "going"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={`flex-1 w-full sm:w-auto ${
                          attendanceStates[game.id]?.status === "going"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                        }`}
                        onClick={() => handleAttendanceChange(game.id, "going")}
                      >
                        Going
                      </Button>
                      <Button
                        variant={
                          attendanceStates[game.id]?.status === "maybe"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={`flex-1 w-full sm:w-auto ${
                          attendanceStates[game.id]?.status === "maybe"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : ""
                        }`}
                        onClick={() => handleAttendanceChange(game.id, "maybe")}
                      >
                        Maybe
                      </Button>
                      <Button
                        variant={
                          attendanceStates[game.id]?.status === "not_going"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={`flex-1 w-full sm:w-auto ${
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
            <div className="text-xl font-black uppercase tracking-widest text-slate-500 mt-12 mb-2">
              Past Games
            </div>
            {pastGames.map((game: any) => (
              <Card key={game.id} className="opacity-75 overflow-visible">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 p-4 sm:p-6 pb-2">
                  <CardTitle className="text-xl font-semibold break-words">
                    vs {game.opposingTeam}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {format(utcToLocalDate(game.date), "MMM d, yyyy")} •{" "}
                      {game.time}
                    </div>
                    {currentTeam?.membership?.isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="outline" asChild>
                          <Link to={`/teams/${teamId}/games/${game.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to={`/teams/${teamId}/games/${game.id}/score`}>
                            <Trophy className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteGame(game.id)}
                          disabled={deleteGameMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-sm text-muted-foreground">
                    Location: {game.location}
                  </div>

                  {/* Team Attendance List */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {expandedGames[game.id]
                      ? gameAttendance[game.id]?.map((att) => (
                          <Badge
                            key={att.id}
                            size="sm"
                            className={`${getStatusColor(
                              att.status
                            )} text-white`}
                          >
                            {att.teamMember?.user?.name || "Unknown"}
                          </Badge>
                        ))
                      : gameAttendance[game.id]?.slice(0, 3).map((att) => (
                          <Badge
                            key={att.id}
                            size="sm"
                            className={`${getStatusColor(
                              att.status
                            )} text-white`}
                          >
                            {att.teamMember?.user?.name || "Unknown"}
                          </Badge>
                        ))}
                    {gameAttendance[game.id] &&
                      gameAttendance[game.id].length > 3 && (
                        <button
                          onClick={() => toggleGameExpansion(game.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                        >
                          {expandedGames[game.id]
                            ? "Show less"
                            : `+${gameAttendance[game.id].length - 3} more`}
                        </button>
                      )}
                  </div>

                  {/* Score Display */}
                  {game.finalScore !== undefined &&
                    game.opponentScore !== undefined && (
                      <div className="mt-2 text-lg font-semibold">
                        {game.finalScore} - {game.opponentScore}
                        {game.finalScore > game.opponentScore && (
                          <span className="ml-2 text-green-600">Win</span>
                        )}
                        {game.finalScore < game.opponentScore && (
                          <span className="ml-2 text-red-600">Loss</span>
                        )}
                        {game.finalScore === game.opponentScore && (
                          <span className="ml-2 text-yellow-600">Tie</span>
                        )}
                      </div>
                    )}

                  {/* Attendance Section - Read-only for past games */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 mb-2">
                      Your attendance:
                    </div>
                    <div className="flex space-x-2">
                      <Button
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
