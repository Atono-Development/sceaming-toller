import { useState, useEffect, useRef } from "react";
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
import { useToast } from "../../hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Loader2, Pencil, Trash2 } from "lucide-react";

type Half = "top" | "bottom";

type EnteredHalves = Record<number, { top: boolean; bottom: boolean }>;

const scoreFormSchema = z.object({
  finalScore: z.string().min(0, "Final score is required"),
  opponentScore: z.string().min(0, "Opponent score is required"),
});

const inningFormSchema = z.object({
  inning: z.string().min(1, "Inning number is required"),
  half: z.enum(["top", "bottom"]),
  runs: z.string().min(1, "Runs is required"),
});

function teamForHalf(half: Half, isHome: boolean): "us" | "opponent" {
  const topTeam = isHome ? "opponent" : "us";
  if (half === "top") return topTeam;
  return topTeam === "us" ? "opponent" : "us";
}

function getHalfLabel(half: Half, isHome: boolean): string {
  const team = teamForHalf(half, isHome);
  const teamLabel = team === "us" ? "Us" : "Opponent";
  const halfLabel = half === "top" ? "Top" : "Bottom";
  return `${halfLabel} (${teamLabel})`;
}

function getRunsForHalf(
  score: InningScore,
  half: Half,
  isHome: boolean
): number {
  const team = teamForHalf(half, isHome);
  return team === "us" ? score.teamScore : score.opponentScore;
}

function applyHalfScore(
  existing: InningScore | undefined,
  inning: number,
  half: Half,
  runs: number,
  isHome: boolean
): InningScore {
  let teamScore = existing?.teamScore ?? 0;
  let opponentScore = existing?.opponentScore ?? 0;

  if (teamForHalf(half, isHome) === "us") {
    teamScore = runs;
  } else {
    opponentScore = runs;
  }

  return { inning, teamScore, opponentScore };
}

function getNextHalf(
  inning: number,
  half: Half
): { inning: number; half: Half } {
  if (half === "top") return { inning, half: "bottom" };
  if (inning >= 7) return { inning: 7, half: "bottom" };
  return { inning: inning + 1, half: "top" };
}

function getFirstIncompleteHalf(
  enteredHalves: EnteredHalves,
  maxInning = 7
): { inning: number; half: Half } {
  for (let inning = 1; inning <= maxInning; inning++) {
    const entered = enteredHalves[inning];
    if (!entered?.top) return { inning, half: "top" };
    if (!entered?.bottom) return { inning, half: "bottom" };
  }
  return { inning: maxInning, half: "bottom" };
}

function upsertInningScore(
  scores: InningScore[],
  updated: InningScore
): InningScore[] {
  const existingIndex = scores.findIndex((s) => s.inning === updated.inning);
  if (existingIndex >= 0) {
    const next = [...scores];
    next[existingIndex] = updated;
    return next;
  }
  return [...scores, updated].sort((a, b) => a.inning - b.inning);
}

function buildEnteredHalvesFromSaved(
  scores: InningScore[],
  isHome: boolean
): EnteredHalves {
  const entered: EnteredHalves = {};
  for (const score of scores) {
    // A saved row means at least one half was entered. In normal flow top is
    // saved first; bottom is inferred as entered only when it has runs (0 is
    // ambiguous on reload — see plan known limitation).
    entered[score.inning] = {
      top: true,
      bottom: getRunsForHalf(score, "bottom", isHome) > 0,
    };
  }
  return entered;
}

export function ScoreGamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>();
  const { currentTeam } = useTeamContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState("");
  const [inningScores, setInningScores] = useState<InningScore[]>([]);
  const [enteredHalves, setEnteredHalves] = useState<EnteredHalves>({});
  const initializedGameId = useRef<string | null>(null);

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
      inning: "1",
      half: "top",
      runs: "",
    },
  });

  const watchedInning = inningForm.watch("inning");
  const watchedHalf = inningForm.watch("half");

  useEffect(() => {
    if (!game || !gameId) return;

    setInningScores(game.inningScores ?? []);

    // Only initialize form/enteredHalves once per game. Query refetches after
    // auto-save must not reset the form (which would skip to the next inning).
    if (initializedGameId.current !== gameId) {
      initializedGameId.current = gameId;

      scoreForm.reset({
        finalScore: game.finalScore?.toString() || "",
        opponentScore: game.opponentScore?.toString() || "",
      });

      const initialEntered = buildEnteredHalvesFromSaved(
        game.inningScores ?? [],
        game.isHome
      );
      setEnteredHalves(initialEntered);

      const next = getFirstIncompleteHalf(initialEntered);
      inningForm.reset({
        inning: next.inning.toString(),
        half: next.half,
        runs: "",
      });
    }
  }, [game, gameId, scoreForm, inningForm]);

  useEffect(() => {
    if (inningScores.length > 0) {
      const teamTotal = inningScores.reduce((sum, s) => sum + s.teamScore, 0);
      const opponentTotal = inningScores.reduce(
        (sum, s) => sum + s.opponentScore,
        0
      );

      scoreForm.setValue("finalScore", teamTotal.toString());
      scoreForm.setValue("opponentScore", opponentTotal.toString());
    }
  }, [inningScores, scoreForm]);

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

  function onHalfSubmit(values: z.infer<typeof inningFormSchema>) {
    if (!game) return;

    const inning = parseInt(values.inning);
    const half = values.half;
    const runs = parseInt(values.runs);
    const existing = inningScores.find((s) => s.inning === inning);
    const merged = applyHalfScore(existing, inning, half, runs, game.isHome);

    const previousScores = inningScores;
    const previousEntered = enteredHalves;

    setInningScores((prev) => upsertInningScore(prev, merged));
    setEnteredHalves((prev) => ({
      ...prev,
      [inning]: {
        top: half === "top" || prev[inning]?.top || false,
        bottom: half === "bottom" || prev[inning]?.bottom || false,
      },
    }));

    updateInningsMutation.mutate([merged], {
      onSuccess: () => {
        toast({
          title: `Inning ${inning} — ${getHalfLabel(half, game.isHome).toLowerCase()} saved`,
        });
        const next = getNextHalf(inning, half);
        inningForm.reset({
          inning: next.inning.toString(),
          half: next.half,
          runs: "",
        });
        setError("");
      },
      onError: () => {
        setInningScores(previousScores);
        setEnteredHalves(previousEntered);
        toast({
          variant: "destructive",
          title: "Failed to save inning score",
        });
        setError("Failed to update inning scores");
      },
    });
  }

  function editHalf(inning: number, half: Half) {
    if (!game) return;

    const existing = inningScores.find((s) => s.inning === inning);
    const hasEntry = enteredHalves[inning]?.[half];
    const runs =
      existing && hasEntry ? getRunsForHalf(existing, half, game.isHome) : 0;

    inningForm.reset({
      inning: inning.toString(),
      half,
      runs: hasEntry ? runs.toString() : "",
    });
  }

  function removeInning(inning: number) {
    setInningScores(inningScores.filter((i) => i.inning !== inning));
    setEnteredHalves((prev) => {
      const next = { ...prev };
      delete next[inning];
      return next;
    });
  }

  function saveInningScores() {
    if (inningScores.length === 0) return;

    updateInningsMutation.mutate(inningScores, {
      onSuccess: () => {
        toast({ title: "All inning scores saved" });
        setError("");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to save inning scores",
        });
        setError("Failed to update inning scores");
      },
    });
  }

  function formatHalfDisplay(
    inning: number,
    half: Half,
    score: InningScore | undefined
  ): string {
    if (!score || !enteredHalves[inning]?.[half]) return "—";
    return getRunsForHalf(score, half, game!.isHome).toString();
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

  const contextLabel = getHalfLabel(watchedHalf, game.isHome);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Record Score</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back to Game
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Inning Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...inningForm}>
              <form
                onSubmit={inningForm.handleSubmit(onHalfSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-2">
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
                    name="runs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Runs</FormLabel>
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

                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  Recording:{" "}
                  <span className="font-medium">
                    Inning {watchedInning || "—"} — {contextLabel}
                  </span>
                </div>

                <FormField
                  control={inningForm.control}
                  name="half"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Half (override if needed)
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="top">
                            Top ({teamForHalf("top", game.isHome) === "us"
                              ? "Us"
                              : "Opponent"})
                          </SelectItem>
                          <SelectItem value="bottom">
                            Bottom (
                            {teamForHalf("bottom", game.isHome) === "us"
                              ? "Us"
                              : "Opponent"}
                            )
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateInningsMutation.isPending}
                  className="w-full"
                >
                  {updateInningsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Record Runs
                </Button>
              </form>
            </Form>

            {(inningScores.length > 0 ||
              Object.keys(enteredHalves).length > 0) && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">Current Inning Scores:</div>
                {[...new Set([
                  ...inningScores.map((s) => s.inning),
                  ...Object.keys(enteredHalves).map(Number),
                ])]
                  .sort((a, b) => a - b)
                  .map((inningNum) => {
                    const score = inningScores.find(
                      (s) => s.inning === inningNum
                    );
                    return (
                      <div
                        key={inningNum}
                        className="space-y-1 rounded border p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Inning {inningNum}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeInning(inningNum)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {(["top", "bottom"] as const).map((half) => (
                          <div
                            key={half}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>
                              {getHalfLabel(half, game.isHome)}:{" "}
                              {formatHalfDisplay(inningNum, half, score)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => editHalf(inningNum, half)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              {enteredHalves[inningNum]?.[half] ? "Edit" : "Add"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                <Button
                  onClick={saveInningScores}
                  disabled={
                    updateInningsMutation.isPending ||
                    inningScores.length === 0
                  }
                  className="mt-2 w-full"
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
