import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [open, setOpen] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
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
          className="md:hidden"
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
            <div className="pb-4 border-b border-slate-200">
              <p className="text-sm text-slate-500">Welcome,</p>
              <p className="font-medium text-slate-900">{user.name}</p>
            </div>
          )}

          {currentTeam && currentTeam.status !== "pending" && (
            <nav className="flex flex-col space-y-2">
              <Button
                variant="ghost"
                className="justify-start h-12 text-base"
                onClick={() => handleNavigation(`/teams/${currentTeam.id}/games`)}
              >
                Schedule
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

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <TeamSelector />
            <Button
              variant="outline"
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

