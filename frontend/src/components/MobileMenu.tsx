import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { TeamSelector } from "@/components/TeamSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileMenu() {
  const { user, logout } = useAuth();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className=""
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col space-y-4 mt-6">
          {user && (
            <div className="pb-4 border-b-4 border-black">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Welcome,</p>
              <p className="text-xl font-black text-black uppercase">{user.name}</p>
            </div>
          )}

          {user?.isSuperAdmin && (
            <nav className="flex flex-col space-y-2 mt-2">
              <Button
                variant="default"
                className="justify-start h-14 text-lg"
                onClick={() => handleNavigation('/admin/teams')}
              >
                Admin Dashboard
              </Button>
            </nav>
          )}

          {currentTeam && currentTeam.status !== "pending" && (
            <nav className="flex flex-col space-y-2">
              <Button
                variant="ghost"
                className="justify-start h-12 text-base"
                onClick={() => handleNavigation(`/teams/${currentTeam.id}/games`)}
              >
                Schedule & Scores
              </Button>
              <Button
                variant="ghost"
                className="justify-start h-12 text-base"
                onClick={() => handleNavigation(`/teams/${currentTeam.id}/roster`)}
              >
                Roster
              </Button>
              <Button
                variant="ghost"
                className="justify-start h-12 text-base"
                onClick={() => handleNavigation(`/teams/${currentTeam.id}/lineup`)}
              >
                Lineup
              </Button>
              <Button
                variant="ghost"
                className="justify-start h-12 text-base"
                onClick={() => handleNavigation(`/teams/${currentTeam.id}/profile`)}
              >
                Profile
              </Button>
            </nav>
          )}

          <div className="pt-4 border-t-4 border-black space-y-4">
            <div className="p-1 px-0">
               <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Switch Team</p>
               <TeamSelector />
            </div>
            <Button
              variant="brutalist"
              className="w-full h-12 text-base"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

