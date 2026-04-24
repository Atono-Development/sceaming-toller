import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeamContext } from "../contexts/TeamContext";
import { updateTeam } from "../api/teams";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { useToast } from "../hooks/use-toast";
import { MessageSquare, Save } from "lucide-react";

export function WhatsAppConfig() {
  const { currentTeam } = useTeamContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = React.useState(currentTeam?.whatsAppGroupId || "");

  // Update local state when currentTeam changes (e.g. initial load)
  React.useEffect(() => {
    if (currentTeam?.whatsAppGroupId) {
      setGroupId(currentTeam.whatsAppGroupId);
    }
  }, [currentTeam?.whatsAppGroupId]);

  const mutation = useMutation({
    mutationFn: (newGroupId: string) => {
      if (!currentTeam) throw new Error("No team selected");
      return updateTeam(currentTeam.id, { whatsAppGroupId: newGroupId });
    },
    onSuccess: (updatedTeam) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      // Also update the local context if needed, but invalidating queries usually handles it
      toast({
        title: "Settings updated",
        description: "WhatsApp Group ID has been saved.",
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: string } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data || "Failed to update WhatsApp settings",
      });
    },
  });

  const handleSave = () => {
    mutation.mutate(groupId);
  };

  if (!currentTeam) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">WhatsApp Reminders</CardTitle>
        </div>
        <CardDescription>
          Configure the WhatsApp Group Chat ID to enable automated attendance reminders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="grid w-full gap-1.5 slice-1">
            <Label htmlFor="whatsAppGroupId">WhatsApp Group Chat ID</Label>
            <Input
              id="whatsAppGroupId"
              placeholder="e.g. 120363xxxxxx@g.us"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Obtain this ID from your Whapi channel dashboard or group info.
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={mutation.isPending || groupId === (currentTeam?.whatsAppGroupId || "")}
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? "Saving..." : "Save ID"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
