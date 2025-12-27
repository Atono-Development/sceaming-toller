import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getTeamGames } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Game {
  id: string;
  date: string;
  time: string;
  location: string;
  opposingTeam: string;
  status: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);

  useEffect(() => {
    if (currentTeam?.id) {
      getTeamGames(currentTeam.id)
        .then((games: Game[]) => {
          const now = new Date();
          // Reset time to start of day for comparison to include games today
          now.setHours(0, 0, 0, 0);

          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);

          const filtered = games.filter((g: Game) => {
            // Parse the date string as UTC components to construct a specific calendar date in local time
            // g.date comes as "2025-12-25T00:00:00Z" (UTC midnight).
            // new Date(g.date) shifts it to local time (e.g. Dec 24 4pm).
            // We want "Dec 25" regardless of where the user is.
            const utcDate = new Date(g.date);
            const gameDate = new Date(
              utcDate.getUTCFullYear(),
              utcDate.getUTCMonth(),
              utcDate.getUTCDate()
            );

            return (
              gameDate >= now &&
              gameDate <= nextWeek &&
              g.status !== "completed" &&
              g.status !== "cancelled"
            );
          });
          setUpcomingGames(filtered);
        })
        .catch((err: unknown) => console.error("Failed to fetch games:", err));
    }
  }, [currentTeam]);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
            <p className="text-slate-600">Managing your softball teams</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>My Team</CardTitle>
              <CardDescription>
                {currentTeam ? "Currently managing" : "No team selected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentTeam ? (
                <div className="space-y-2">
                  <p className="text-xl font-semibold">{currentTeam.name}</p>
                  <p className="text-slate-500">
                    {currentTeam.league} - {currentTeam.season}
                  </p>
                  {currentTeam.description && (
                    <p className="text-sm text-slate-600 italic">
                      {currentTeam.description}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">No teams joined yet.</p>
              )}
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => navigate("/teams/create")}
              >
                Create New Team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>
                Manage your position preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentTeam ? (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/teams/${currentTeam.id}/profile`)}
                >
                  Update Preferences
                </Button>
              ) : (
                <p className="text-slate-500 italic">
                  Select a team to manage preferences.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Games</CardTitle>
              <CardDescription>
                Your schedule for the next 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingGames.length > 0 ? (
                <div className="space-y-4">
                  {upcomingGames.map((game: Game) => {
                    const d = new Date(game.date);
                    // Force local date interpretation
                    const localDate = new Date(
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate()
                    );

                    return (
                      <div
                        key={game.id}
                        className="border-b last:border-0 pb-2 last:pb-0"
                      >
                        <p className="font-semibold">
                          {localDate.toLocaleDateString()} at {game.time}
                        </p>
                        <p className="text-sm">vs {game.opposingTeam}</p>
                        <p className="text-sm text-slate-500">
                          {game.location}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 italic">No upcoming games.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
