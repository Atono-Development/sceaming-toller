import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeamContext } from "../../contexts/TeamContext";
import {
  getTeamMembers,
  removeMember,
  getAllTeamMemberPreferences,
} from "../../api/members";
import { InviteMemberDialog } from "../../components/InviteMemberDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Trash2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { format } from "date-fns";

export function RosterPage() {
  const { currentTeam, isAdmin } = useTeamContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["teamMembers", currentTeam?.id],
    queryFn: () => {
      if (!currentTeam) throw new Error("No team selected");
      return getTeamMembers(currentTeam.id);
    },
    enabled: !!currentTeam,
  });

  const { data: memberPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["teamMemberPreferences", currentTeam?.id],
    queryFn: () => {
      if (!currentTeam) throw new Error("No team selected");
      return getAllTeamMemberPreferences(currentTeam.id);
    },
    enabled: !!currentTeam && isAdmin,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => {
      if (!currentTeam) throw new Error("No team selected");
      return removeMember(currentTeam.id, memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", currentTeam?.id],
      });
      toast({
        title: "Member removed",
        description: "The team member has been removed.",
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: string } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data || "Failed to remove member",
      });
    },
  });

  const handleRemove = (memberId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMutation.mutate(memberId);
    }
  };

  if (!currentTeam) {
    return <div>Select a team to view the roster.</div>;
  }

  if (isLoading || (isAdmin && preferencesLoading)) {
    return <div>Loading roster...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team Roster</h1>
        {isAdmin && <InviteMemberDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {isAdmin && <TableHead>Position Preferences</TableHead>}
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => {
              const preferences = memberPreferences?.find(
                (p) => p.id === member.id
              );

              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user?.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.gender === "M" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {member.gender === "M"
                        ? "M"
                        : member.gender === "F"
                        ? "F"
                        : "Not Set"}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.user?.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.role.split(",").map((role, index) => (
                        <Badge
                          key={index}
                          variant={
                            role.trim() === "Admin" ? "default" : "secondary"
                          }
                          className="text-xs capitalize"
                        >
                          {role.trim()}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {preferences && preferences.preferences.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {preferences.preferences
                            .sort((a, b) => a.preferenceRank - b.preferenceRank)
                            .map((pref) => (
                              <Badge
                                key={pref.id}
                                variant={
                                  pref.preferenceRank === 1
                                    ? "default"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {pref.position} ({pref.preferenceRank})
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No preferences set
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {format(new Date(member.joinedAt), "MMM d, yyyy")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(member.id)}
                        disabled={member.role === "admin"}
                        title={
                          member.role === "admin"
                            ? "Cannot remove admin"
                            : "Remove member"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
