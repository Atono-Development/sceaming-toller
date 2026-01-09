import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeamContext } from "../../contexts/TeamContext";
import {
  getGame,
  updateGameScore,
  updateInningScores,
  type InningScore,
} from "../../api/games";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";

const scoreFormSchema = z.object({
  finalScore: z.string().min(0, "Final score is required"),
  opponentScore: z.string().min(0, "Opponent score is required"),
});

const inningFormSchema = z.object({
  inning: z.string().min(1, "Inning number is required"),
  teamScore: z.string().min(0, "Team score is required"),
  opponentScore: z.string().min(0, "Opponent score is required"),
});

export function ScoreGamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [inningScores, setInningScores] = useState<InningScore[]>([]);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", teamId, gameId],
    queryFn: () => getGame(teamId!, gameId!),
    enabled: !!teamId && !!gameId,
  });

  const scoreForm = useForm<z.infer<typeof scoreFormSchema>>({
    resolver: zodResolver(scoreFormSchema),
    defaultValues: {
      finalScore: "",
      opponentScore: "",
    },
  });

  const inningForm = useForm<z.infer<typeof inningFormSchema>>({
    resolver: zodResolver(inningFormSchema),
    defaultValues: {
      inning: "",
      teamScore: "",
      opponentScore: "",
    },
  });

  // Update form when game data is loaded
  useEffect(() => {
    if (game) {
      scoreForm.reset({
        finalScore: game.finalScore?.toString() || "",
        opponentScore: game.opponentScore?.toString() || "",
      });
      if (game.inningScores) {
        setInningScores(game.inningScores);
      }
    }
  }, [game, scoreForm]);

  const updateScoreMutation = useMutation({
    mutationFn: (values: { finalScore: number; opponentScore: number }) =>
      updateGameScore(
        teamId!,
        gameId!,
        values.finalScore,
        values.opponentScore
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-games", teamId] });
      queryClient.invalidateQueries({ queryKey: ["game", teamId, gameId] });
    },
    onError: () => {
      setError("Failed to update score");
    },
  });

  const updateInningsMutation = useMutation({
    mutationFn: (scores: InningScore[]) =>
      updateInningScores(teamId!, gameId!, scores),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-games", teamId] });
      queryClient.invalidateQueries({ queryKey: ["game", teamId, gameId] });
    },
    onError: () => {
      setError("Failed to update inning scores");
    },
  });

  async function onScoreSubmit(values: z.infer<typeof scoreFormSchema>) {
    if (!currentTeam) return;
    updateScoreMutation.mutate({
      finalScore: parseInt(values.finalScore),
      opponentScore: parseInt(values.opponentScore),
    });
  }

  function onInningSubmit(values: z.infer<typeof inningFormSchema>) {
    const newInning: InningScore = {
      inning: parseInt(values.inning),
      teamScore: parseInt(values.teamScore),
      opponentScore: parseInt(values.opponentScore),
    };

    // Check if inning already exists
    const existingIndex = inningScores.findIndex(
      (i) => i.inning === newInning.inning
    );
    if (existingIndex >= 0) {
      const updatedScores = [...inningScores];
      updatedScores[existingIndex] = newInning;
      setInningScores(updatedScores);
    } else {
      setInningScores(
        [...inningScores, newInning].sort((a, b) => a.inning - b.inning)
      );
    }

    inningForm.reset();
  }

  function removeInning(inning: number) {
    setInningScores(inningScores.filter((i) => i.inning !== inning));
  }

  function saveInningScores() {
    if (inningScores.length > 0) {
      updateInningsMutation.mutate(inningScores);
    }
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
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Record Score</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back to Game
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Final Score Card */}
        <Card>
          <CardHeader>
            <CardTitle>Final Score</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...scoreForm}>
              <form
                onSubmit={scoreForm.handleSubmit(onScoreSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={scoreForm.control}
                    name="finalScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Our Score</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scoreForm.control}
                    name="opponentScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opponent Score</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={updateScoreMutation.isPending}
                  className="w-full"
                >
                  {updateScoreMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Final Score
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Inning Scores Card */}
        <Card>
          <CardHeader>
            <CardTitle>Inning Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...inningForm}>
              <form
                onSubmit={inningForm.handleSubmit(onInningSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={inningForm.control}
                    name="inning"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inning</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="7"
                            placeholder="1"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inningForm.control}
                    name="teamScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Our Score</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inningForm.control}
                    name="opponentScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opponent</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Inning
                </Button>
              </form>
            </Form>

            {/* Inning Scores List */}
            {inningScores.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">
                  Current Inning Scores:
                </div>
                {inningScores.map((inning) => (
                  <div
                    key={inning.inning}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <span className="text-sm">
                      Inning {inning.inning}: {inning.teamScore} -{" "}
                      {inning.opponentScore}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeInning(inning.inning)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={saveInningScores}
                  disabled={updateInningsMutation.isPending}
                  className="w-full mt-2"
                >
                  {updateInningsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Inning Scores
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
