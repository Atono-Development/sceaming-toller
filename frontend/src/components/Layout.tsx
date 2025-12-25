import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { TeamSelector } from "@/components/TeamSelector";

export default function Layout() {
  const { user, logout } = useAuth();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                Screaming Toller
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                 <span className="text-sm text-slate-500 hidden md:inline-block">Welcome, {user.name}</span>
              )}
              
              {currentTeam && (
                <Button variant="ghost" onClick={() => navigate(`/teams/${currentTeam.id}/games`)}>
                  Schedule
                </Button>
              )}
              
              <TeamSelector />
              
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
