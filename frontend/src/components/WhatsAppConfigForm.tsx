import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { useAuth } from "../contexts/AuthContext";
import { useTeamContext } from "../contexts/TeamContext";
import { updateMe } from "../api/auth";
import { updateTeam } from "../api/teams";
import { useToast } from "../hooks/use-toast";

const WhatsAppConfigForm: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { teams, refreshTeams } = useTeamContext();
  const { toast } = useToast();
  
  const [token, setToken] = useState(user?.whapiToken || "");
  const [loading, setLoading] = useState(false);

  // Find teams where the user is an admin
  const adminTeams = teams.filter(t => t.membership?.isAdmin);

  if (adminTeams.length === 0) return null;

  const handleSaveToken = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedUser = await updateMe(user.name, user.optOutReminders, token);
      updateUser(updatedUser);
      setToken(updatedUser.whapiToken || "");
      toast({ title: "Success", description: "WhatsApp API token updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update API token.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTeamToken = async (teamId: string, isChecked: boolean) => {
    if (!user) return;
    try {
      await updateTeam(teamId, { 
        whapiTokenSourceUserId: isChecked ? user.id : null 
      });
      await refreshTeams();
      toast({ title: "Success", description: "Team WhatsApp configuration updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update team configuration.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Whapi API Token</label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter your Whapi API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button onClick={handleSaveToken} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your token is encrypted and stored securely. Masked as ******** after saving.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Use my WhatsApp key for these teams:</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminTeams.map((team) => (
              <div key={team.id} className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={`team-${team.id}`}
                  checked={team.whapiTokenSourceUserId === user?.id}
                  onCheckedChange={(checked) => handleToggleTeamToken(team.id, !!checked)}
                />
                <label htmlFor={`team-${team.id}`} className="text-sm font-medium cursor-pointer flex-1">
                  {team.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConfigForm;
