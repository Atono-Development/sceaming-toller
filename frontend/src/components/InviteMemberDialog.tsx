import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { inviteMember } from "../api/invitations";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useToast } from "./ui/use-toast";
import { useTeamContext } from "../contexts/TeamContext";
import { Loader2, Copy } from "lucide-react";

interface InviteMemberForm {
  email: string;
  role: string;
}

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const { currentTeam } = useTeamContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<InviteMemberForm>({
    defaultValues: {
      role: "player",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InviteMemberForm) => {
      if (!currentTeam) throw new Error("No team selected");
      return inviteMember(currentTeam.id, data.email, data.role);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teamMembers", currentTeam?.id] });
      // Generate invite link
      const link = `${window.location.origin}/invitations/${data.token}`;
      setInviteLink(link);
      toast({
        title: "Invitation Created",
        description: "Share the link with the player to join.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data || "Failed to invite member",
      });
    },
  });

  const onSubmit = (data: InviteMemberForm) => {
    mutation.mutate(data);
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard.",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form and state when closing
      reset();
      setInviteLink(null);
      mutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Invite Player</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Create an invitation link for a new team member.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                placeholder="player@example.com"
                className="col-span-3"
                {...register("email", { required: true })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                defaultValue="player"
                onValueChange={(val) => setValue("role", val)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Invite
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="link" className="sr-only">
                  Link
                </Label>
                <Input
                  id="link"
                  defaultValue={inviteLink}
                  readOnly
                />
              </div>
              <Button type="button" size="sm" className="px-3" onClick={copyToClipboard}>
                <span className="sr-only">Copy</span>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Send this link to the player. It will expire in 7 days.
            </p>
            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
