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
import {
  getMyPreferences,
  updateMyPreferences,
  type TeamMemberPreference,
} from "../api/members";
import { useToast } from "../hooks/use-toast";

const POSITIONS = [
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "C",
  "Rover",
  "Pitcher",
];

interface PlayerPreferencesFormProps {
  teamId: string;
}

const PlayerPreferencesForm: React.FC<PlayerPreferencesFormProps> = ({
  teamId,
}) => {
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPreferences();
  }, [teamId]);

  const loadPreferences = async () => {
    try {
      const data = await getMyPreferences(teamId);
      setPreferences(data);
    } catch (error) {
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
      const prefsToSave = preferences.map((p) => ({
        position: p.position,
        preferenceRank: p.preferenceRank,
      }));

      await updateMyPreferences(teamId, prefsToSave);
      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch (error) {
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
    return pref?.position || "";
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Select up to 3 preferred positions in order of preference (1 = most
          preferred).
        </div>

        {[1, 2, 3].map((rank) => (
          <div key={rank} className="space-y-2">
            <Label htmlFor={`position-${rank}`}>Preference {rank}</Label>
            <Select
              value={getCurrentPositionForRank(rank)}
              onValueChange={(value) => handlePositionChange(rank, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select position ${rank}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No preference</SelectItem>
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
