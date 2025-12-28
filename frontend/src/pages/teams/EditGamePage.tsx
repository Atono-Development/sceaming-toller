import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeamContext } from "../../contexts/TeamContext";
import { getGame, updateGame } from "../../api/games";
import { Button } from "../../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { TimePicker } from "../../components/ui/time-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  location: z.string().min(1, "Location is required"),
  opposingTeam: z.string().min(1, "Opposing team is required"),
});

export function EditGamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", teamId, gameId],
    queryFn: () => getGame(teamId!, gameId!),
    enabled: !!teamId && !!gameId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "",
      time: "",
      location: "",
      opposingTeam: "",
    },
  });

  // Update form when game data is loaded
  if (game && form.getValues().date === "") {
    form.reset({
      date: game.date.split("T")[0], // Format date for input
      time: game.time,
      location: game.location,
      opposingTeam: game.opposingTeam,
    });
  }

  const updateGameMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) =>
      updateGame(teamId!, gameId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-games", teamId] });
      navigate(`/teams/${teamId}/games`);
    },
    onError: () => {
      setError("Failed to update game");
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!currentTeam) return;
    updateGameMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="text-center">Game not found</div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit Game</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Field 3, Central Park" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="opposingTeam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opposing Team</FormLabel>
                    <FormControl>
                      <Input placeholder="Team Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateGameMutation.isPending}>
                  {updateGameMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Game
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
