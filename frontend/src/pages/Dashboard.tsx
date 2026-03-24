import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getTeamGames } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import {
  getMyPreferences,
  getMyTeamMemberInfo,
  type TeamMemberPreference,
} from "../api/members";
import { getAttendance, updateAttendance, type Attendance } from "../api/games";
import { utcToLocalDate, getTodayAtMidnight } from "../utils/dateUtils";

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
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>([]);
  const [isPitcher, setIsPitcher] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    if (currentTeam?.id) {
      getTeamGames(currentTeam.id)
        .then((games: Game[]) => {
          const now = getTodayAtMidnight();
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);

          const filtered = games.filter((g: Game) => {
            const gameDate = utcToLocalDate(g.date);

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

  useEffect(() => {
    if (currentTeam?.id) {
      const loadPreferences = async () => {
        setLoadingPreferences(true);
        try {
          const [preferencesData, memberInfo] = await Promise.all([
            getMyPreferences(currentTeam.id),
            getMyTeamMemberInfo(currentTeam.id),
          ]);
          setPreferences(preferencesData);
          setIsPitcher(memberInfo.role.includes("pitcher"));
        } catch (err: unknown) {
          console.error("Failed to fetch preferences:", err);
        } finally {
          setLoadingPreferences(false);
        }
      };
      loadPreferences();
    }
  }, [currentTeam]);

  useEffect(() => {
    if (currentTeam?.id && upcomingGames.length > 0) {
      const loadAttendance = async () => {
        const nextGame = upcomingGames[0];
        setLoadingAttendance(true);
        try {
          const attendanceData = await getAttendance(
            currentTeam.id,
            nextGame.id
          );
          const myAttendance = attendanceData.find(
            (att: any) => user?.id && att.teamMember?.user?.id === user.id
          );
          setAttendance(myAttendance || null);
        } catch (err: unknown) {
          console.error("Failed to fetch attendance:", err);
        } finally {
          setLoadingAttendance(false);
        }
      };
      loadAttendance();
    }
  }, [currentTeam, upcomingGames, user?.id]);

  const handleAttendanceChange = (status: string) => {
    if (currentTeam?.id && upcomingGames.length > 0) {
      const nextGame = upcomingGames[0];
      updateAttendance(currentTeam.id, nextGame.id, status)
        .then(() => {
          setAttendance({
            id: "",
            teamMemberId: "",
            gameId: nextGame.id,
            status,
            updatedAt: new Date().toISOString(),
          });
        })
        .catch((err: unknown) =>
          console.error("Failed to update attendance:", err)
        );
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-black pb-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
              Dashboard
            </h1>
            <p className="text-lg font-medium">Welcome back, {user?.name}</p>
          </div>
          {currentTeam && (
            <div className="mt-4 md:mt-0 px-4 py-2 bg-orange-600 text-white font-bold uppercase tracking-widest text-sm">
              {currentTeam.name}
            </div>
          )}
        </header>

        {currentTeam?.status === "pending" ? (
          <div className="border-4 border-orange-600 p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-black uppercase mb-2">Review Pending</h2>
            <p className="font-medium">
              Your team "{currentTeam.name}" is currently being reviewed. You will be notified via email once approved.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Next Game Hero Section */}
            {upcomingGames.length > 0 && (
              <section className="border-4 border-orange-600 p-0 overflow-hidden bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <div className="bg-black text-white p-3 px-6 flex justify-between items-center">
                  <h2 className="text-xl font-black uppercase tracking-tight">Next Game</h2>
                  <span className="font-bold uppercase text-sm tracking-widest">Upcoming</span>
                </div>
                <div className="p-6 md:p-8 lg:p-10 flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
                  {/* Logo Placeholder */}
                  <div className="w-32 h-32 md:w-48 md:h-48 border-4 border-orange-600 flex items-center justify-center p-4 flex-shrink-0 bg-white">
                    <div className="text-center">
                      <div className="text-4xl md:text-6xl mb-2">🥎</div>
                      <div className="text-xs font-black uppercase leading-tight">Team Logo</div>
                    </div>
                  </div>

                  <div className="flex-grow flex flex-col justify-between space-y-6 text-center lg:text-left">
                    <div>
                      <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-2 leading-none">
                        vs {upcomingGames[0].opposingTeam}
                      </h3>
                      <div className="space-y-1 font-bold text-lg md:text-xl uppercase">
                        <p>
                          {utcToLocalDate(upcomingGames[0].date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })} @ {upcomingGames[0].time}
                        </p>
                        <p className="text-orange-600 underline decoration-4 underline-offset-4 decoration-black">
                          {upcomingGames[0].location}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="font-black uppercase text-sm tracking-widest">Confirm your attendance:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                          onClick={() => handleAttendanceChange("going")}
                          disabled={loadingAttendance}
                          className={`py-4 px-6 border-4 font-black uppercase tracking-tighter text-xl transition-all active:translate-y-1 active:shadow-none ${
                            attendance?.status === "going"
                              ? "bg-green-600 text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-white hover:bg-slate-50 border-orange-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                          }`}
                        >
                          Going
                        </button>
                        <button
                          onClick={() => handleAttendanceChange("maybe")}
                          disabled={loadingAttendance}
                          className={`py-4 px-6 border-4 font-black uppercase tracking-tighter text-xl transition-all active:translate-y-1 active:shadow-orange-600 ${
                            attendance?.status === "maybe"
                              ? "bg-yellow-500 text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-white hover:bg-slate-50 border-orange-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                          }`}
                        >
                          Maybe
                        </button>
                        <button
                          onClick={() => handleAttendanceChange("not_going")}
                          disabled={loadingAttendance}
                          className={`py-4 px-6 border-4 font-black uppercase tracking-tighter text-xl transition-all active:translate-y-1 active:shadow-none ${
                            attendance?.status === "not_going"
                              ? "bg-red-600 text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-white hover:bg-slate-100 border-orange-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Secondary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* My Team Card */}
              <div className="border-4 border-black p-0 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="bg-black text-white p-2 px-4 uppercase font-black text-sm tracking-widest">
                  My Team
                </div>
                <div className="p-6">
                  {currentTeam ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-2xl font-black uppercase leading-tight">{currentTeam.name}</p>
                        <p className="font-bold text-orange-600 uppercase text-sm tracking-tighter">
                          {currentTeam.league} • {currentTeam.season}
                        </p>
                      </div>
                      {currentTeam.description && (
                        <p className="text-sm font-medium border-l-4 border-black pl-3 py-1 italic">
                          {currentTeam.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="font-black uppercase text-slate-400">No Team Joined</p>
                  )}
                </div>
              </div>

              {/* My Profile Card */}
              <div className="border-4 border-black p-0 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="bg-black text-white p-2 px-4 uppercase font-black text-sm tracking-widest">
                  My Profile
                </div>
                <div className="p-6 flex flex-col justify-between h-[calc(100%-36px)]">
                  <div>
                    <p className="font-black uppercase text-xs tracking-widest mb-3">Positions</p>
                    {loadingPreferences ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-slate-200 w-3/4"></div>
                        <div className="h-4 bg-slate-200 w-1/2"></div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {isPitcher && (
                          <span className="px-3 py-1 bg-black text-white font-black uppercase text-xs border-2 border-black">
                            Pitcher
                          </span>
                        )}
                        {preferences
                          .sort((a, b) => a.preferenceRank - b.preferenceRank)
                          .map((pref) => (
                            <span
                              key={pref.preferenceRank}
                              className="px-3 py-1 bg-orange-600 text-white font-black border-2 border-black uppercase text-xs"
                            >
                              {pref.position}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => navigate(`/teams/${currentTeam?.id}/profile`)}
                    disabled={!currentTeam}
                    className="mt-6 w-full py-2 border-2 border-orange-600 font-black uppercase text-xs tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    Edit Preferences
                  </button>
                </div>
              </div>

              {/* Schedule Card */}
              <div className="border-4 border-black p-0 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="bg-black text-white p-2 px-4 uppercase font-black text-sm tracking-widest">
                  Upcoming Schedule
                </div>
                <div className="p-6">
                  {upcomingGames.length > 1 ? (
                    <div className="space-y-4">
                      {upcomingGames.slice(1, 4).map((game: Game) => (
                        <div key={game.id} className="pb-3 border-b-2 border-slate-100 last:border-0 last:pb-0">
                          <p className="font-black uppercase text-sm leading-tight">Vs {game.opposingTeam}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">
                            {utcToLocalDate(game.date).toLocaleDateString()} @ {game.time}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-black uppercase text-slate-400 italic">No more games scheduled</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
