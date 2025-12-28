import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Save } from "lucide-react";
import { useTeamContext } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import {
  getTeamGames,
  getBattingOrder,
  getFieldingLineup,
  generateCompleteFieldingLineup,
  generateBattingOrder,
  type BattingOrder,
  type FieldingLineup,
  type Game,
} from "@/api/games";

const LineupPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { currentTeam } = useTeamContext();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [battingOrder, setBattingOrder] = useState<BattingOrder[]>([]);
  const [fieldingLineup, setFieldingLineup] = useState<FieldingLineup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBattingOrder, setEditingBattingOrder] = useState(false);
  const [editingFieldingLineup, setEditingFieldingLineup] = useState(false);

  React.useEffect(() => {
    if (teamId) {
      loadGames();
    }
  }, [teamId]);

  React.useEffect(() => {
    if (selectedGame) {
      loadLineups();
    }
  }, [selectedGame]);

  const loadGames = async () => {
    try {
      const gamesData = await getTeamGames(teamId!);
      setGames(gamesData);
      if (gamesData.length > 0 && !selectedGame) {
        setSelectedGame(gamesData[0]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive",
      });
    }
  };

  const loadLineups = async () => {
    if (!selectedGame) return;

    try {
      setLoading(true);
      const [batting, fielding] = await Promise.all([
        getBattingOrder(teamId!, selectedGame.id),
        getFieldingLineup(teamId!, selectedGame.id),
      ]);

      setBattingOrder(batting);
      setFieldingLineup(fielding);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load lineups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const groupFieldingByInning = () => {
    const grouped: Record<number, FieldingLineup[]> = {};
    fieldingLineup.forEach((player) => {
      if (!grouped[player.inning]) {
        grouped[player.inning] = [];
      }
      grouped[player.inning].push(player);
    });
    return grouped;
  };

  const calculatePlayingTimeStats = () => {
    const stats: Record<string, { innings: number; positions: string[] }> = {};

    fieldingLineup.forEach((player) => {
      const playerName = player.teamMember?.user?.name || "Unknown";
      if (!stats[playerName]) {
        stats[playerName] = { innings: 0, positions: [] };
      }
      stats[playerName].innings++;
      if (!stats[playerName].positions.includes(player.position)) {
        stats[playerName].positions.push(player.position);
      }
    });

    return stats;
  };

  const generateAllInnings = async () => {
    if (!selectedGame) return;

    try {
      setLoading(true);
      await generateCompleteFieldingLineup(teamId!, selectedGame.id);
      await loadLineups();
      toast({
        title: "Success",
        description:
          "Generated complete 7-inning fielding lineup with balanced playing time",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate complete lineup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateBattingOrderLineup = async () => {
    if (!selectedGame) return;

    try {
      setLoading(true);
      await generateBattingOrder(teamId!, selectedGame.id);
      await loadLineups();
      toast({
        title: "Success",
        description: "Generated batting order with gender balance",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate batting order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: string) => {
    const infieldPositions = ["1B", "2B", "3B", "SS", "C"];
    const outfieldPositions = ["LF", "CF", "RF"];

    if (position === "Pitcher") return "bg-purple-500";
    if (position === "Rover") return "bg-orange-500";
    if (infieldPositions.includes(position)) return "bg-blue-500";
    if (outfieldPositions.includes(position)) return "bg-green-500";
    return "bg-gray-500";
  };

  if (!teamId || !currentTeam) {
    return <div>Loading...</div>;
  }

  const fieldingByInning = groupFieldingByInning();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Lineup Management</h1>
        <div className="flex items-center gap-4">
          <Select
            value={selectedGame?.id || ""}
            onValueChange={(value) => {
              const game = games.find((g) => g.id === value);
              setSelectedGame(game || null);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  {game.opposingTeam} -{" "}
                  {new Date(game.date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedGame && (
        <Card>
          <CardHeader>
            <CardTitle>Lineups - {selectedGame.opposingTeam}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {new Date(selectedGame.date).toLocaleDateString()} at{" "}
              {selectedGame.time} • {selectedGame.location}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Button
                onClick={generateAllInnings}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Generate All 7 Innings (Balanced)
              </Button>
              <Button
                onClick={generateBattingOrderLineup}
                disabled={loading}
                className="flex items-center gap-2"
                variant="outline"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Regenerate Batting Order
              </Button>
            </div>
            <Tabs defaultValue="batting" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="batting">Batting Order</TabsTrigger>
                <TabsTrigger value="fielding">Fielding Positions</TabsTrigger>
                <TabsTrigger value="stats">Playing Time</TabsTrigger>
              </TabsList>

              <TabsContent value="batting" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Batting Order</h3>
                  <Button
                    onClick={() => setEditingBattingOrder(!editingBattingOrder)}
                    variant={editingBattingOrder ? "default" : "outline"}
                    size="sm"
                  >
                    {editingBattingOrder ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      "Edit Order"
                    )}
                  </Button>
                </div>
                {battingOrder.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No batting order has been set for this game yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {battingOrder.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                            {player.battingPosition}
                          </div>
                          <span className="font-medium">
                            {player.teamMember?.user?.name || "Unknown Player"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const isPitcher = player.teamMember?.role
                              .split(",")
                              .map((role) => role.trim().toLowerCase())
                              .includes("pitcher");

                            return (
                              <>
                                {isPitcher && (
                                  <Badge variant="default">Pitcher</Badge>
                                )}
                                <Badge variant="outline">
                                  {player.teamMember?.gender === "M"
                                    ? "Male"
                                    : "Female"}
                                </Badge>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fielding" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Fielding Positions</h3>
                  <Button
                    onClick={() =>
                      setEditingFieldingLineup(!editingFieldingLineup)
                    }
                    variant={editingFieldingLineup ? "default" : "outline"}
                    size="sm"
                  >
                    {editingFieldingLineup ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      "Edit Positions"
                    )}
                  </Button>
                </div>
                {Object.keys(fieldingByInning).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No fielding lineup has been set for this game yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(fieldingByInning)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([inning, players]) => (
                        <div key={inning} className="space-y-2">
                          <h3 className="text-lg font-semibold">
                            Inning {inning}
                          </h3>
                          <div className="grid grid-cols-3 gap-2">
                            {players.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center gap-2 p-2 rounded border"
                              >
                                <Badge
                                  className={getPositionColor(player.position)}
                                >
                                  {player.position}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {player.teamMember?.user?.name || "Unknown"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Playing Time Statistics
                  </h3>
                  {Object.entries(calculatePlayingTimeStats())
                    .sort(([, a], [, b]) => b.innings - a.innings)
                    .map(([playerName, stats]) => {
                      const percentage = (stats.innings / 7) * 100;
                      return (
                        <div key={playerName} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{playerName}</span>
                            <span className="text-sm text-muted-foreground">
                              {stats.innings}/7 innings (
                              {Math.round(percentage)}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          <div className="flex flex-wrap gap-1">
                            {stats.positions.map((position) => (
                              <Badge
                                key={position}
                                variant="outline"
                                className="text-xs"
                              >
                                {position}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!selectedGame && games.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No games found. Create a game first to manage lineups.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LineupPage;
