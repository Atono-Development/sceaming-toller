import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamSelector } from "@/components/TeamSelector";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { currentTeam } = useTeams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
            <p className="text-slate-600">Managing your softball teams</p>
          </div>
          <div className="flex items-center space-x-4">
            <TeamSelector />
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <p className="text-slate-500">{currentTeam.league} - {currentTeam.season}</p>
                  {currentTeam.description && (
                    <p className="text-sm text-slate-600 italic">{currentTeam.description}</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">No teams joined yet.</p>
              )}
              <Button className="mt-4 w-full" variant="outline" onClick={() => navigate('/teams/create')}>
                Create New Team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Games</CardTitle>
              <CardDescription>Your schedule for the next 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 italic">No upcoming games.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
