import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { getTeamGames } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { useTeamContext } from '../../contexts/TeamContext'

export function GamesPage() {
  const { teamId } = useParams()
  const { currentTeam } = useTeamContext()

  const { data: games, isLoading } = useQuery({
    queryKey: ['team-games', teamId],
    queryFn: () => getTeamGames(teamId!),
    enabled: !!teamId,
  })

  if (isLoading) return <div>Loading schedule...</div>

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        {currentTeam?.membership?.role === 'admin' && (
          <Button asChild>
            <Link to={`/teams/${teamId}/games/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Game
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {games?.map((game: any) => (
          <Card key={game.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold">
                vs {game.opposingTeam}
              </CardTitle>
              <div className="text-sm font-medium text-muted-foreground">
                {format(new Date(game.date), 'MMM d, yyyy')} • {game.time}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Location: {game.location}
              </div>
              <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                {game.status}
              </div>
            </CardContent>
          </Card>
        ))}
        {games?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No games scheduled yet.
          </div>
        )}
      </div>
    </div>
  )
}
