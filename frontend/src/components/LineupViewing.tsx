import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  getBattingOrder,
  getFieldingLineup,
  type BattingOrder,
  type FieldingLineup,
  type Game,
} from "../api/games";
import { useToast } from "../hooks/use-toast";

interface LineupViewingProps {
  teamId: string;
  game: Game;
}

const LineupViewing: React.FC<LineupViewingProps> = ({ teamId, game }) => {
  const [battingOrder, setBattingOrder] = useState<BattingOrder[]>([]);
  const [fieldingLineup, setFieldingLineup] = useState<FieldingLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadLineups();
  }, [teamId, game.id]);

  const loadLineups = async () => {
    try {
      const [batting, fielding] = await Promise.all([
        getBattingOrder(teamId, game.id),
        getFieldingLineup(teamId, game.id),
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

  const getPositionColor = (position: string) => {
    const infieldPositions = ["1B", "2B", "3B", "SS", "C"];
    const outfieldPositions = ["LF", "CF", "RF"];

    if (position === "Pitcher") return "bg-purple-500";
    if (position === "Rover") return "bg-orange-500";
    if (infieldPositions.includes(position)) return "bg-blue-500";
    if (outfieldPositions.includes(position)) return "bg-green-500";
    return "bg-gray-500";
  };

  if (loading) {
    return <div>Loading lineups...</div>;
  }

  const fieldingByInning = groupFieldingByInning();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lineups - {game.opposingTeam}</CardTitle>
        <div className="text-sm text-muted-foreground">
          {new Date(game.date).toLocaleDateString()} at {game.time} •{" "}
          {game.location}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="batting" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batting">Batting Order</TabsTrigger>
            <TabsTrigger value="fielding">Fielding Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="batting" className="space-y-4">
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
                    {player.isGenerated && (
                      <Badge variant="secondary">Auto-generated</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fielding" className="space-y-4">
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
                      <h3 className="text-lg font-semibold">Inning {inning}</h3>
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
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LineupViewing;
