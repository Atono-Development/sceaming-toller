import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  getAttendance,
  updateAttendance,
  adminUpdateAttendance,
  initializeGameAttendance,
  type Attendance,
  type Game,
} from "../api/games";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";

interface AttendanceManagementProps {
  teamId: string;
  game: Game;
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({
  teamId,
  game,
}) => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [myAttendance, setMyAttendance] = useState<string>("not_going");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTeam } = useTeamContext();

  const isAdmin = currentTeam?.membership?.role === "admin";

  useEffect(() => {
    loadAttendance();
  }, [teamId, game.id, user]);

  const loadAttendance = async () => {
    try {
      const data = await getAttendance(teamId, game.id);
      setAttendance(data);

      // Find current user's attendance
      const userAttendance = data.find(
        (att) => att.teamMember?.user?.email === user?.email
      );
      setMyAttendance(userAttendance?.status || "not_going");
    } catch {
      toast({
        title: "Error",
        description: "Failed to load attendance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = async (status: string) => {
    setSaving(true);
    try {
      await updateAttendance(teamId, game.id, status);
      setMyAttendance(status);

      // Update the attendance list to reflect the change
      await loadAttendance();

      toast({
        title: "Success",
        description: "Attendance updated successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAdminAttendanceChange = async (
    teamMemberId: string,
    status: string
  ) => {
    setSaving(true);
    try {
      await adminUpdateAttendance(teamId, game.id, teamMemberId, status);

      // Update the attendance list to reflect the change
      await loadAttendance();

      toast({
        title: "Success",
        description: "Member attendance updated successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update member attendance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeAttendance = async () => {
    setSaving(true);
    try {
      await initializeGameAttendance(teamId, game.id);

      // Refresh attendance data
      await loadAttendance();

      toast({
        title: "Success",
        description: "Attendance initialized for all team members",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to initialize attendance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "going":
        return "bg-green-500";
      case "maybe":
        return "bg-yellow-500";
      case "not_going":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "going":
        return "Going";
      case "maybe":
        return "Maybe";
      case "not_going":
        return "Not Going";
      default:
        return "Unknown";
    }
  };

  const goingCount = attendance.filter((a) => a.status === "going").length;
  const maybeCount = attendance.filter((a) => a.status === "maybe").length;
  const notGoingCount = attendance.filter(
    (a) => a.status === "not_going"
  ).length;

  if (loading) {
    return <div>Loading attendance...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance - {game.opposingTeam}</CardTitle>
        <div className="text-sm text-muted-foreground">
          {new Date(game.date).toLocaleDateString()} at {game.time} •{" "}
          {game.location}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* My Attendance */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">My Attendance</h3>
          <Select
            value={myAttendance}
            onValueChange={handleAttendanceChange}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your attendance status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="going">Going</SelectItem>
              <SelectItem value="maybe">Maybe</SelectItem>
              <SelectItem value="not_going">Not Going</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Attendance Summary */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Attendance Summary</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">Going: {goingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">Maybe: {maybeCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm">Not Going: {notGoingCount}</span>
            </div>
          </div>
        </div>

        {/* Team Attendance List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Team Attendance</h3>
            {isAdmin && (
              <span className="text-sm text-muted-foreground">
                Admin: Click to edit member status
              </span>
            )}
          </div>

          <div className="space-y-2">
            {attendance.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 rounded border"
              >
                <span className="font-medium">
                  {att.teamMember?.user?.name || "Unknown Player"}
                </span>
                {isAdmin ? (
                  <Select
                    value={att.status}
                    onValueChange={(status) =>
                      handleAdminAttendanceChange(att.teamMemberId, status)
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="going">Going</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                      <SelectItem value="not_going">Not Going</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={getStatusColor(att.status)}>
                    {getStatusText(att.status)}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="text-center py-4">
              <Button
                onClick={handleInitializeAttendance}
                disabled={saving}
                variant="outline"
              >
                {saving ? "Initializing..." : "Initialize Missing Attendance"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceManagement;
