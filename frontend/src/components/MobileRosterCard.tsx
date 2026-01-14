import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

interface TeamMember {
  id: string;
  gender: string;
  role: string;
  joinedAt: string;
  isAdmin?: boolean;
  user?: {
    name: string;
    email: string;
  };
}

interface MemberPreference {
  id: string;
  preferences: Array<{
    id: string;
    position: string;
    preferenceRank: number;
  }>;
}

interface MobileRosterCardProps {
  member: TeamMember;
  isAdmin: boolean;
  preferences?: MemberPreference;
  onRemove: (id: string) => void;
}

export function MobileRosterCard({
  member,
  isAdmin,
  preferences,
  onRemove,
}: MobileRosterCardProps) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg">{member.user?.name}</div>
            <div className="text-sm text-muted-foreground">{member.user?.email}</div>
          </div>
          <Badge variant={member.gender === "M" ? "default" : "secondary"}>
            {member.gender === "M" ? "M" : member.gender === "F" ? "F" : "Not Set"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block mb-1">Roles</span>
            <div className="flex flex-wrap gap-1">
              {member.isAdmin && (
                <Badge variant="default" className="text-xs">
                  Admin
                </Badge>
              )}
              {member.role
                .split(",")
                .map((role) => role.trim())
                .filter((role) => role !== "" && !role.toLowerCase().includes("admin"))
                .map((role, index) => (
                  <Badge key={index} variant="secondary" className="text-xs capitalize">
                    {role}
                  </Badge>
                ))}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block mb-1">Joined</span>
            <span>{format(new Date(member.joinedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {isAdmin && preferences && preferences.preferences.length > 0 && (
          <div>
            <span className="text-muted-foreground block mb-1 text-sm">Preferences</span>
            <div className="flex flex-wrap gap-1">
              {preferences.preferences
                .sort((a, b) => a.preferenceRank - b.preferenceRank)
                .map((pref) => (
                  <Badge
                    key={pref.id}
                    variant={pref.preferenceRank === 1 ? "default" : "outline"}
                    className="text-xs"
                  >
                    {pref.position} ({pref.preferenceRank})
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onRemove(member.id)}
              disabled={member.isAdmin}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Member
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
