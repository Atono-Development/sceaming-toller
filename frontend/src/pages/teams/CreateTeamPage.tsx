import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../../lib/api';
import { useTeams } from '../../contexts/TeamContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';

const createTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  league: z.string().min(1, 'League is required'),
  season: z.string().min(1, 'Season is required'),
});

type CreateTeamValues = z.infer<typeof createTeamSchema>;

export const CreateTeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshTeams, setCurrentTeam } = useTeams();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamValues>({
    resolver: zodResolver(createTeamSchema),
  });

  const onSubmit = async (values: CreateTeamValues) => {
    try {
      const response = await api.post('/teams', values);
      await refreshTeams();
      setCurrentTeam(response.data);
      navigate('/');
    } catch (error) {
      console.error('Failed to create team', error);
      alert('Failed to create team. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-slate-900 text-center">Create a New Team</CardTitle>
          <CardDescription className="text-slate-500 text-center">
            Set up your slo-pitch team to start managing lineups and games.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">Team Name</Label>
              <Input
                id="name"
                placeholder="e.g. The Screaming Tollers"
                className="border-slate-300 focus:ring-indigo-500"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-500 font-medium">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g. Sunday night recreational league"
                className="border-slate-300 focus:ring-indigo-500"
                {...register('description')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="league" className="text-sm font-medium text-slate-700">League</Label>
              <Input
                id="league"
                placeholder="e.g. City Parks & Rec"
                className="border-slate-300 focus:ring-indigo-500"
                {...register('league')}
              />
              {errors.league && (
                <p className="text-sm text-red-500 font-medium">{errors.league.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="season" className="text-sm font-medium text-slate-700">Season</Label>
              <Input
                id="season"
                placeholder="e.g. Summer 2024"
                className="border-slate-300 focus:ring-indigo-500"
                {...register('season')}
              />
              {errors.season && (
                <p className="text-sm text-red-500 font-medium">{errors.season.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 pt-4">
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Team'}
            </Button>
            <Button variant="ghost" type="button" className="w-full text-slate-500 hover:text-slate-700" onClick={() => navigate('/')}>
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
