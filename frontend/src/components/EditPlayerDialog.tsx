import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import type { TeamMember, TeamMemberPreference } from "../api/members";

const POSITIONS = ["1B", "2B", "3B", "SS", "LF", "CF", "RF", "C", "Rover"];

interface EditPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  currentPreferences: TeamMemberPreference[];
  onSave: (preferences: { position: string; preferenceRank: number }[], isPitcher: boolean) => Promise<void>;
}

export function EditPlayerDialog({
  open,
  onOpenChange,
  member,
  currentPreferences,
  onSave,
}: EditPlayerDialogProps) {
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>([]);
  const [isPitcher, setIsPitcher] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPreferences(currentPreferences || []);
      setIsPitcher(member.role?.toLowerCase().includes("pitcher") || false);
    }
  }, [open, currentPreferences, member]);

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

      await onSave(prefsToSave, isPitcher);
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Player Settings</DialogTitle>
          <DialogDescription>
            Edit position preferences and pitcher status for {member.user?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="admin-pitcher"
              checked={isPitcher}
              onCheckedChange={(checked: boolean) => setIsPitcher(checked)}
            />
            <Label htmlFor="admin-pitcher">Pitcher</Label>
          </div>

          <div className="text-sm text-muted-foreground">
            Select up to 3 preferred fielding positions in order of preference (1 = most preferred).
          </div>

          {[1, 2, 3].map((rank) => (
            <div key={rank} className="space-y-2">
              <Label htmlFor={`admin-position-${rank}`}>
                Preference {rank}
              </Label>
              <Select
                value={getCurrentPositionForRank(rank) || "none"}
                onValueChange={(value) => handlePositionChange(rank, value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Select position ${rank} (optional)`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getAvailablePositions(rank).map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
