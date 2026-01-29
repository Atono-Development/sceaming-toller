import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeamContext } from "../../contexts/TeamContext";
import {
  getTeamMembers,
  removeMember,
  getAllTeamMemberPreferences,
  updateMemberPreferences,
  updateMemberPitcherStatus,
} from "../../api/members";
import { InviteMemberDialog } from "../../components/InviteMemberDialog";
import { EditPlayerDialog } from "../../components/EditPlayerDialog";
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
import { Trash2, Edit } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { format } from "date-fns";
import { MobileRosterCard } from "../../components/MobileRosterCard";

export function RosterPage() {
  const { currentTeam, isAdmin } = useTeamContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMember, setEditingMember] = React.useState<{
    member: any;
    preferences: any[];
  } | null>(null);

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

  const updatePreferencesMutation = useMutation({
    mutationFn: ({ memberId, preferences }: { memberId: string; preferences: { position: string; preferenceRank: number }[] }) => {
      if (!currentTeam) throw new Error("No team selected");
      return updateMemberPreferences(currentTeam.id, memberId, preferences);
    },
  });

  const updatePitcherMutation = useMutation({
    mutationFn: ({ memberId, isPitcher }: { memberId: string; isPitcher: boolean }) => {
      if (!currentTeam) throw new Error("No team selected");
      return updateMemberPitcherStatus(currentTeam.id, memberId, isPitcher);
    },
  });

  const handleRemove = (memberId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMutation.mutate(memberId);
    }
  };

  const handleEditPlayer = (member: any) => {
    const preferences = memberPreferences?.find((p) => p.id === member.id);
    setEditingMember({
      member,
      preferences: preferences?.preferences || [],
    });
  };

  const handleSavePlayer = async (preferences: { position: string; preferenceRank: number }[], isPitcher: boolean) => {
    if (!editingMember || !currentTeam) return;

    try {
      await Promise.all([
        updatePreferencesMutation.mutateAsync({
          memberId: editingMember.member.id,
          preferences,
        }),
        updatePitcherMutation.mutateAsync({
          memberId: editingMember.member.id,
          isPitcher,
        }),
      ]);

      queryClient.invalidateQueries({
        queryKey: ["teamMembers", currentTeam.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["teamMemberPreferences", currentTeam.id],
      });

      toast({
        title: "Success",
        description: "Player settings updated successfully.",
      });
      setEditingMember(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update player settings.",
      });
      throw error;
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

      <div className="rounded-md border hidden md:block">
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
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {role}
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPlayer(member)}
                          title="Edit player settings"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(member.id)}
                          disabled={member.isAdmin}
                          title={
                            member.isAdmin
                              ? "Cannot remove admin"
                              : "Remove member"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {members?.map((member) => (
          <MobileRosterCard
            key={member.id}
            member={member}
            isAdmin={isAdmin}
            preferences={memberPreferences?.find((p) => p.id === member.id)}
            onRemove={handleRemove}
            onEdit={handleEditPlayer}
          />
        ))}
      </div>

      {editingMember && (
        <EditPlayerDialog
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          member={editingMember.member}
          currentPreferences={editingMember.preferences}
          onSave={handleSavePlayer}
        />
      )}
    </div>
  );
}
