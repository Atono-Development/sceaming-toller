import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
            <p className="text-slate-600">Managing your softball teams</p>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>My Teams</CardTitle>
              <CardDescription>Teams you are a member of</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 italic">No teams joined yet.</p>
              <Button className="mt-4 w-full" variant="outline">
                Create or Join Team
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
