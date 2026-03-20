import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  getMyPreferences,
  updateMyPreferences,
  getMyTeamMemberInfo,
  updateMyPitcherStatus,
  updateMyGender,
  type TeamMemberPreference,
} from "../api/members";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import { updateMe } from "../api/auth";

const POSITIONS = ["1B", "2B", "3B", "SS", "LF", "CF", "RF", "C", "Rover"];

interface PlayerPreferencesFormProps {
  teamId: string;
}

const PlayerPreferencesForm: React.FC<PlayerPreferencesFormProps> = ({
  teamId,
}) => {
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>([]);
  const [isPitcher, setIsPitcher] = useState(false);
  const [gender, setGender] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();
  const { user, updateUser } = useAuth();

  useEffect(() => {
    loadPreferences();
  }, [teamId]);

  const loadPreferences = async () => {
    try {
      const [preferencesData, memberInfo] = await Promise.all([
        getMyPreferences(teamId),
        getMyTeamMemberInfo(teamId),
      ]);
      setPreferences(preferencesData);
      setIsPitcher(memberInfo.role.includes("pitcher"));
      setGender(memberInfo.gender || "");
      
      // Initialize name from auth user if not set
      if (user && !name) {
        setName(user.name || "");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePositionChange = (rank: number, position: string) => {
    setPreferences((prev) => {
      const newPrefs = [...prev];
      const existingIndex = newPrefs.findIndex(
        (p) => p.preferenceRank === rank
      );

      if (existingIndex >= 0) {
        if (position === "") {
          // Remove this preference
          newPrefs.splice(existingIndex, 1);
          // Renumber remaining preferences
          newPrefs.forEach((p) => {
            if (p.preferenceRank > rank) {
              p.preferenceRank--;
            }
          });
        } else {
          // Update existing preference
          newPrefs[existingIndex].position = position;
        }
      } else if (position !== "") {
        // Add new preference
        newPrefs.push({
          id: "",
          teamMemberId: "",
          position,
          preferenceRank: rank,
        });
      }

      return newPrefs;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save position preferences
      const prefsToSave = preferences.map((p) => ({
        position: p.position,
        preferenceRank: p.preferenceRank,
      }));

      await updateMyPreferences(teamId, prefsToSave);

      // Save pitcher status
      await updateMyPitcherStatus(teamId, isPitcher);

      // Save gender
      if (gender && gender !== "") {
        await updateMyGender(teamId, gender);
      }

      // Save name if changed
      if (user && name !== user.name) {
        const updatedUser = await updateMe(name);
        updateUser(updatedUser);
      }

      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getAvailablePositions = (currentRank: number) => {
    const selectedPositions = preferences
      .filter((p) => p.preferenceRank !== currentRank)
      .map((p) => p.position);

    return POSITIONS.filter((pos) => !selectedPositions.includes(pos));
  };

  const getCurrentPositionForRank = (rank: number) => {
    const pref = preferences.find((p) => p.preferenceRank === rank);
    return pref?.position;
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Information & Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Select up to 3 preferred positions in order of preference (1 = most
          preferred). These are for fielding positions only.
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <input
              id="name"
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
            />
            <div className="text-sm text-muted-foreground">
              This is how your name will appear in lineups and rosters.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={gender || ""}
              onValueChange={(value) => setGender(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Male (M)</SelectItem>
                <SelectItem value="F">Female (F)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Gender information is required for proper lineup creation.
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="pitcher"
              checked={isPitcher}
              onCheckedChange={(checked: boolean) => setIsPitcher(checked)}
            />
            <Label htmlFor="pitcher">I am a pitcher</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            Pitchers are included in the batting order but not counted as
            fielding preferences.
          </div>
        </div>

        {[1, 2, 3].map((rank) => (
          <div key={rank} className="space-y-2">
            <Label htmlFor={`position-${rank}`}>Preference {rank}</Label>
            <Select
              value={getCurrentPositionForRank(rank)}
              onValueChange={(value) => handlePositionChange(rank, value)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={`Select position ${rank} (optional)`}
                />
              </SelectTrigger>
              <SelectContent>
                {getAvailablePositions(rank).map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PlayerPreferencesForm;
