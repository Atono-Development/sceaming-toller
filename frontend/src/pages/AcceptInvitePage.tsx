import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInvitation, acceptInvitation } from "../api/invitations";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => {
        if (!token) throw new Error("No token provided");
        return getInvitation(token)
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => {
        if (!token) throw new Error("No token provided");
        return acceptInvitation(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-teams"] }); // Refresh teams list
      toast({
        title: "Joined Team",
        description: `You have successfully joined ${invitation?.team?.name || 'the team'}.`,
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data || "Failed to join team",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation may have expired or does not exist.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate("/")}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Handle nested object structure from backend if necessary. 
  // GORM Preload usually puts it in `Team` field. 
  // API response wrapper might be plain or have data field. 
  // My api client returns response.data directly.
  // The backend `GetInvitation` returns the struct directly.
  // So `invitation` is the Invitation struct.
  // `invitation.Team` should be the team.
  // Since `invitation` is `any` (or defined interface), I should be careful. 
  // The interface I defined in api/invitations.ts expects:
  /*
    interface Invitation {
        ...
    }
  */
  // I updated the interface to include team.
  const teamName = invitation?.team?.name || "the team";

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>You're invited!</CardTitle>
          <CardDescription>
            You have been invited to join <strong>{teamName}</strong> as a{" "}
            <span className="capitalize">{invitation.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="text-sm text-muted-foreground text-center">
                Click below to accept the invitation and add this team to your dashboard.
             </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            className="w-full" 
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join Team
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
