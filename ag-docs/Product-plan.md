# Slo-Pitch Softball Team Manager - Product Plan (Multi-Team Platform)

## Project Overview

A scalable web application for managing recreational slo-pitch softball teams with gender-balanced lineup requirements, attendance tracking, and game management. The platform supports multiple teams with players participating across different teams.

---

## Technical Stack

### Backend

- **Language**: Go 1.21+
- **Framework**: Chi router (lightweight, idiomatic)
- **Database**: PostgreSQL 15+
- **ORM**: GORM or sqlc (for type-safe queries)
- **Authentication**: JWT tokens
- **API Style**: REST

### Frontend

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **State Management**: React Query (TanStack Query) for server state
- **UI Library**: shadcn/ui (Tailwind-based components)
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v6

### DevOps

- **Hosting**: DigitalOcean Droplet (Ubuntu 22.04 LTS)
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)
- **Process Manager**: systemd
- **Database**: PostgreSQL (same droplet or managed database)
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

---

## Data Model (Multi-Team Architecture)

### Core Entities

```go
type User struct {
    ID           uuid.UUID
    Name         string
    Email        string `gorm:"uniqueIndex"`
    PasswordHash string
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

type Team struct {
    ID          uuid.UUID
    Name        string
    Description string
    League      string
    Season      string // e.g., "Summer 2024", "Fall 2024"
    IsActive    bool
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

type TeamMember struct {
    ID       uuid.UUID
    TeamID   uuid.UUID `gorm:"index"`
    UserID   uuid.UUID `gorm:"index"`
    Gender   string    // "M" or "F" - can vary per team
    Role     string    // "admin", "player", "pitcher"
    IsActive bool      // For soft-delete when leaving team
    JoinedAt time.Time
    LeftAt   *time.Time

    // Relationships
    Team Team `gorm:"foreignKey:TeamID"`
    User User `gorm:"foreignKey:UserID"`

    // Composite unique index to prevent duplicate memberships
    // gorm:"uniqueIndex:idx_team_user_active"
}

type TeamMemberPreference struct {
    ID             uuid.UUID
    TeamMemberID   uuid.UUID `gorm:"index"`
    Position       string
    PreferenceRank int // 1, 2, or 3

    // Relationship
    TeamMember TeamMember `gorm:"foreignKey:TeamMemberID"`
}

type Game struct {
    ID            uuid.UUID
    TeamID        uuid.UUID `gorm:"index"`
    Date          time.Time `gorm:"index"`
    Time          string
    Location      string
    OpposingTeam  string
    FinalScore    *int // nullable
    OpponentScore *int // nullable
    Status        string // "scheduled", "in_progress", "completed", "cancelled"
    CreatedAt     time.Time
    UpdatedAt     time.Time

    // Relationship
    Team Team `gorm:"foreignKey:TeamID"`
}

type Attendance struct {
    ID           uuid.UUID
    TeamMemberID uuid.UUID `gorm:"index"`
    GameID       uuid.UUID `gorm:"index"`
    Status       string    // "going", "not_going", "maybe"
    UpdatedAt    time.Time

    // Relationships
    TeamMember TeamMember `gorm:"foreignKey:TeamMemberID"`
    Game       Game       `gorm:"foreignKey:GameID"`

    // Composite unique index
    // gorm:"uniqueIndex:idx_game_member"
}

type BattingOrder struct {
    ID              uuid.UUID
    GameID          uuid.UUID `gorm:"index"`
    TeamMemberID    uuid.UUID
    BattingPosition int
    IsGenerated     bool
    CreatedAt       time.Time

    // Relationships
    Game       Game       `gorm:"foreignKey:GameID"`
    TeamMember TeamMember `gorm:"foreignKey:TeamMemberID"`
}

type FieldingLineup struct {
    ID           uuid.UUID
    GameID       uuid.UUID `gorm:"index"`
    Inning       int       // 1-7
    TeamMemberID uuid.UUID
    Position     string // "1B", "2B", "3B", "SS", "LF", "CF", "RF", "C", "Rover"
    IsGenerated  bool
    CreatedAt    time.Time

    // Relationships
    Game       Game       `gorm:"foreignKey:GameID"`
    TeamMember TeamMember `gorm:"foreignKey:TeamMemberID"`
}

type InningScore struct {
    ID     uuid.UUID
    GameID uuid.UUID `gorm:"index"`
    Inning int
    Score  int

    // Relationship
    Game Game `gorm:"foreignKey:GameID"`
}

type Invitation struct {
    ID        uuid.UUID
    TeamID    uuid.UUID
    Email     string
    Token     string `gorm:"uniqueIndex"`
    Role      string // "admin" or "player"
    ExpiresAt time.Time
    AcceptedAt *time.Time
    CreatedBy  uuid.UUID // UserID who sent invite
    CreatedAt  time.Time

    // Relationships
    Team Team `gorm:"foreignKey:TeamID"`
}
```

---

## Multi-Team Architecture Considerations

### Team Context

- All operations are scoped to a team
- Users switch between teams via team selector in UI
- Current team context stored in frontend state
- Backend validates team membership for all operations

### Team Membership

- Users can be members of multiple teams
- Each membership can have different roles (admin on one team, player on another)
- Gender can be specified per team membership (edge case handling)
- Position preferences are team-specific

### Team Isolation

- Games belong to a specific team
- Lineups are team-scoped
- Attendance is tracked per team member per game
- No cross-team data leakage

### Permissions Model

```
Team Admin:
- Create/edit/delete games
- Manage team members (invite, remove, change roles)
- Generate and edit lineups
- Record scores
- View all team data

Team Player:
- View team schedule
- Set own attendance
- View lineups
- Edit own preferences
- View team roster

Platform Level:
- Users manage their own account
- Can leave teams
- Accept invitations to new teams
```

---

## Feature Specifications

### 1. User & Team Management

#### 1.1 User Account

- **Register**: Create account with email/password
- **Login**: Authenticate and receive JWT
- **Profile**: Edit name, email, password
- **Team List**: View all teams user belongs to

#### 1.2 Team Management

- **Create Team**: Initialize new team
- **Edit Team**: Update name, description, league, season
- **Archive Team**: Soft-delete inactive teams
- **Team Settings**: Configure team-specific settings

#### 1.3 Team Membership

- **Invite Members**: Send email invitations
- **Accept Invitation**: Join team via invite link
- **Set Member Role**: Admin or Player
- **Mark as Pitcher**: Designate pitchers per team
- **Remove Member**: Remove from team (soft-delete)
- **Leave Team**: Self-removal from team

### 2. Admin Features (per team)

#### 2.1 Game Management

- **Create Game**: Form with date, time, location, opposing team
- **Edit Game**: Update details
- **Delete Game**: Remove scheduled game
- **Record Final Score**: Input total score (team & opponent)
- **Record Inning Scores**: Input score per inning (1-7)

#### 2.2 Lineup Management

- **Auto-Generate Batting Order**:
  - Algorithm:
    1. Filter team members with "going" attendance
    2. Separate by gender
    3. Alternate M-F starting with the gender with more players
    4. If unequal, place extra players together once in order
    5. Identify pitchers (via TeamMember.Role), space them apart
  - Mark as generated (editable afterward)
- **Auto-Generate Fielding Lineup**:
  - Algorithm:
    1. Get confirmed team members
    2. Select 9 players ensuring 5-4 gender split
    3. Try to avoid players sitting on the bench consecutive innings
    4. Assign positions based on team-specific preferences
    5. Fill remaining positions
    6. Create lineup for inning 1
- **Manual Editing**:
  - Drag-and-drop reordering
  - Swap players
  - Change positions
  - Validate M-F alternation in batting order
  - Validate 5-4 gender split in fielding

#### 2.3 Roster Management

- View all team members
- Invite new members
- Change member roles (admin/player/pitcher)
- Remove members

### 3. Player Features (per team)

#### 3.1 Team Selection

- View list of teams
- Switch active team context
- See role on each team

#### 3.2 Attendance

- View upcoming games for selected team
- Set attendance status (going/not going/maybe)
- See who else is attending

#### 3.3 Preferences

- Select up to 3 preferred positions (per team)
- Different preferences for different teams

#### 3.4 View Lineups

- See batting order for games they're attending
- See fielding positions by inning
- View game schedule

---

## User Flows

### User Flow: Join Platform & Team

```
1. New user visits platform
2. Receives invitation email with link
3. Clicks link → taken to registration page (pre-filled email)
4. Completes registration
5. Automatically added to team that invited them
6. Lands on team dashboard
7. Sets position preferences
```

### User Flow: Create New Team

```
1. Existing user navigates to "My Teams"
2. Clicks "Create Team"
3. Fills in team details (name, league, season)
4. Becomes admin of new team
5. Invited to add other members
```

### Admin Flow: Manage Multiple Teams

```
1. Admin logs in
2. Sees list of teams (with role badges)
3. Selects Team A (admin role)
4. Creates game for Team A
5. Switches to Team B (player role)
6. Sets attendance for Team B game
7. Cannot access admin features on Team B
```

### Player Flow: Multi-Team Context

```
1. Player logs in
2. Default view shows Team A dashboard
3. Uses team selector to switch to Team B
4. Sets attendance for Team B game
5. Preferences and context fully switch to Team B
6. No Team A data visible
```

---

## API Endpoints (Multi-Team)

### Authentication

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
PUT    /api/auth/password
```

### Users

```
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/me/teams (list all teams user belongs to)
```

### Teams

```
GET    /api/teams (all teams user is member of)
POST   /api/teams (create new team)
GET    /api/teams/:id
PUT    /api/teams/:id (admin only)
DELETE /api/teams/:id (admin only, soft-delete)
```

### Team Members

```
GET    /api/teams/:id/members
POST   /api/teams/:id/members/invite (admin - send invitation)
PUT    /api/teams/:id/members/:member_id (admin - update role)
DELETE /api/teams/:id/members/:member_id (admin - remove member)
POST   /api/teams/:id/members/leave (player - self-removal)
PUT    /api/teams/:id/members/me/preferences (update own preferences)
```

### Invitations

```
POST   /api/invitations (admin creates invite)
GET    /api/invitations/:token (view invitation details)
POST   /api/invitations/:token/accept (accept invitation)
GET    /api/teams/:id/invitations (admin views pending invites)
DELETE /api/invitations/:id (admin cancels invite)
```

### Games (Team-scoped)

```
GET    /api/teams/:team_id/games
POST   /api/teams/:team_id/games (admin)
GET    /api/teams/:team_id/games/:id
PUT    /api/teams/:team_id/games/:id (admin)
DELETE /api/teams/:team_id/games/:id (admin)
```

### Attendance (Team-scoped)

```
GET    /api/teams/:team_id/games/:game_id/attendance
PUT    /api/teams/:team_id/games/:game_id/attendance (set own)
GET    /api/teams/:team_id/games/:game_id/attendance/summary (admin)
```

### Lineups (Team-scoped)

```
POST   /api/teams/:team_id/games/:game_id/batting-order/generate (admin)
GET    /api/teams/:team_id/games/:game_id/batting-order
PUT    /api/teams/:team_id/games/:game_id/batting-order (admin)
DELETE /api/teams/:team_id/games/:game_id/batting-order (admin)

POST   /api/teams/:team_id/games/:game_id/fielding/generate (admin)
GET    /api/teams/:team_id/games/:game_id/fielding
PUT    /api/teams/:team_id/games/:game_id/fielding (admin)
DELETE /api/teams/:team_id/games/:game_id/fielding (admin)
```

### Scoring (Team-scoped)

```
PUT    /api/teams/:team_id/games/:game_id/score (admin)
PUT    /api/teams/:team_id/games/:game_id/innings/:inning/score (admin)
GET    /api/teams/:team_id/games/:game_id/score
```

---

## Algorithm Details (Multi-Team Aware)

### Batting Order Generation

```go
func GenerateBattingOrder(
    teamMembers []models.TeamMember,
    gameID uuid.UUID,
) ([]models.BattingOrder, error) {
    // 1. Get attendance for this game
    var attendance []models.Attendance
    db.Where("game_id = ? AND status = ?", gameID, "going").
        Preload("TeamMember").
        Find(&attendance)

    if len(attendance) < 9 {
        return nil, errors.New("insufficient players: need at least 9 confirmed")
    }

    // 2. Extract team members from attendance
    confirmed := make([]models.TeamMember, len(attendance))
    for i, att := range attendance {
        confirmed[i] = att.TeamMember
    }

    // 3. Separate by gender
    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    // 4. Get pitchers for this team
    pitchers := filterByRole(confirmed, "pitcher")
    pitcherIDs := make([]uuid.UUID, len(pitchers))
    for i, p := range pitchers {
        pitcherIDs[i] = p.ID
    }

    // 5. Alternate M-F
    var positions []BattingPosition
    if len(males) >= len(females) {
        positions = alternateGenders(males, females)
    } else {
        positions = alternateGenders(females, males)
    }

    // 6. Space out pitchers
    if len(pitchers) == 2 {
        positions = spacePitchers(positions, pitcherIDs)
    }

    // 7. Convert to BattingOrder models
    result := make([]models.BattingOrder, len(positions))
    for i, pos := range positions {
        result[i] = models.BattingOrder{
            GameID:          gameID,
            TeamMemberID:    pos.TeamMemberID, // Changed from PlayerID
            BattingPosition: pos.Position,
            IsGenerated:     true,
        }
    }

    return result, nil
}

func filterByGender(members []models.TeamMember, gender string) []models.TeamMember {
    result := make([]models.TeamMember, 0)
    for _, m := range members {
        if m.Gender == gender && m.IsActive {
            result = append(result, m)
        }
    }
    return result
}

func filterByRole(members []models.TeamMember, role string) []models.TeamMember {
    result := make([]models.TeamMember, 0)
    for _, m := range members {
        if strings.Contains(strings.ToLower(m.Role), role) && m.IsActive {
            result = append(result, m)
        }
    }
    return result
}
```

### Fielding Lineup Generation (Team-scoped)

```go
func GenerateFieldingLineup(
    teamMembers []models.TeamMember,
    gameID uuid.UUID,
    inning int,
) ([]models.FieldingLineup, error) {
    // 1. Get attendance for this game
    var attendance []models.Attendance
    db.Where("game_id = ? AND status = ?", gameID, "going").
        Preload("TeamMember").
        Preload("TeamMember.Preferences"). // Load team-specific preferences
        Find(&attendance)

    if len(attendance) < 9 {
        return nil, errors.New("insufficient players")
    }

    confirmed := make([]models.TeamMember, len(attendance))
    for i, att := range attendance {
        confirmed[i] = att.TeamMember
    }

    // 2. Separate by gender
    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    // 3. Select 9 with 5-4 split
    var selected []models.TeamMember
    if len(males) >= 5 && len(females) >= 4 {
        selected = append(selectN(males, 5), selectN(females, 4)...)
    } else if len(females) >= 5 && len(males) >= 4 {
        selected = append(selectN(females, 5), selectN(males, 4)...)
    } else {
        return nil, errors.New("cannot achieve 5-4 split")
    }

    positions := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"}

    assignments := make([]models.FieldingLineup, 0, 9)
    assignedPlayers := make(map[uuid.UUID]bool)
    assignedPositions := make(map[string]bool)

    // 4. First pass: assign based on team-specific preferences
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, member := range selected {
            if assignedPlayers[member.ID] {
                continue
            }

            // Check if this position is in member's preferences
            if hasPreferredPosition(member, pos) {
                assignments = append(assignments, models.FieldingLineup{
                    GameID:       gameID,
                    TeamMemberID: member.ID,
                    Position:     pos,
                    Inning:       inning,
                    IsGenerated:  true,
                })
                assignedPlayers[member.ID] = true
                assignedPositions[pos] = true
                break
            }
        }
    }

    // 5. Second pass: fill remaining positions
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, member := range selected {
            if assignedPlayers[member.ID] {
                continue
            }

            assignments = append(assignments, models.FieldingLineup{
                GameID:       gameID,
                TeamMemberID: member.ID,
                Position:     pos,
                Inning:       inning,
                IsGenerated:  true,
            })
            assignedPlayers[member.ID] = true
            assignedPositions[pos] = true
            break
        }
    }

    return assignments, nil
}

func hasPreferredPosition(member models.TeamMember, position string) bool {
    for _, pref := range member.Preferences {
        if pref.Position == position {
            return true
        }
    }
    return false
}
```

---

## Middleware & Authorization

### Team Membership Verification

```go
// internal/middleware/team.go
package middleware

func RequireTeamMembership(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        teamID := chi.URLParam(r, "team_id")
        userID := r.Context().Value("userID").(string)

        var membership models.TeamMember
        result := db.Where("team_id = ? AND user_id = ? AND is_active = ?",
            teamID, userID, true).First(&membership)

        if result.Error != nil {
            http.Error(w, "Not a member of this team", http.StatusForbidden)
            return
        }

        // Add membership to context
        ctx := context.WithValue(r.Context(), "teamMembership", membership)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func RequireTeamAdmin(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        membership := r.Context().Value("teamMembership").(models.TeamMember)

        if membership.Role != "admin" {
            http.Error(w, "Requires admin role", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### Route Setup

```go
// cmd/server/main.go
r.Route("/api/teams/{team_id}", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Use(middleware.RequireTeamMembership)

    // Player routes
    r.Get("/games", handlers.GetTeamGames)
    r.Put("/games/{game_id}/attendance", handlers.UpdateAttendance)
    r.Put("/members/me/preferences", handlers.UpdateMyPreferences)

    // Admin routes
    r.Group(func(r chi.Router) {
        r.Use(middleware.RequireTeamAdmin)

        r.Post("/games", handlers.CreateGame)
        r.Put("/games/{game_id}", handlers.UpdateGame)
        r.Delete("/games/{game_id}", handlers.DeleteGame)
        r.Post("/games/{game_id}/batting-order/generate", handlers.GenerateBattingOrder)
        r.Post("/members/invite", handlers.InviteMember)
    })
})
```

---

## UI Components (Multi-Team)

### Team Selector

```tsx
// src/components/TeamSelector.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TeamSelector = () => {
  const { data: teams } = useQuery(["my-teams"], fetchMyTeams);
  const { currentTeam, setCurrentTeam } = useTeamContext();

  return (
    <Select value={currentTeam?.id} onValueChange={setCurrentTeam}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a team" />
      </SelectTrigger>
      <SelectContent>
        {teams?.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            <div className="flex items-center justify-between w-full">
              <span>{team.name}</span>
              {team.membership.role === "admin" && (
                <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                  Admin
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

### Team Context Provider

```tsx
// src/contexts/TeamContext.tsx
import { createContext, useContext, useState, useEffect } from "react";

interface TeamContextType {
  currentTeam: Team | null;
  setCurrentTeam: (teamId: string) => void;
  isAdmin: boolean;
  membership: TeamMember | null;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }) => {
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(
    localStorage.getItem("currentTeamId")
  );

  const { data: teams } = useQuery(["my-teams"], fetchMyTeams);
  const currentTeam = teams?.find((t) => t.id === currentTeamId);

  useEffect(() => {
    // Auto-select first team if none selected
    if (!currentTeamId && teams && teams.length > 0) {
      setCurrentTeamId(teams[0].id);
    }
  }, [teams, currentTeamId]);

  const setCurrentTeam = (teamId: string) => {
    setCurrentTeamId(teamId);
    localStorage.setItem("currentTeamId", teamId);
  };

  const isAdmin = currentTeam?.membership.role === "admin";
  const membership = currentTeam?.membership || null;

  return (
    <TeamContext.Provider
      value={{ currentTeam, setCurrentTeam, isAdmin, membership }}
    >
      {children}
    </TeamContext.Provider>
  );
};

export const useTeamContext = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeamContext must be used within TeamProvider");
  }
  return context;
};
```

### My Teams Dashboard

```tsx
// src/pages/MyTeams.tsx
export const MyTeams = () => {
  const { data: teams } = useQuery(["my-teams"], fetchMyTeams);
  const navigate = useNavigate();
  const { setCurrentTeam } = useTeamContext();

  const handleSelectTeam = (teamId: string) => {
    setCurrentTeam(teamId);
    navigate("/dashboard");
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Teams</h1>
        <Button onClick={() => navigate("/teams/create")}>
          Create New Team
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((team) => (
          <Card
            key={team.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleSelectTeam(team.id)}
          >
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>
                {team.league} - {team.season}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {team.memberCount} members
                </span>
                {team.membership.role === "admin" && <Badge>Admin</Badge>}
                {team.membership.role.includes("pitcher") && (
                  <Badge variant="secondary">Pitcher</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

### Create Team Form

```tsx
// src/pages/CreateTeam.tsx
export const CreateTeam = () => {
  const navigate = useNavigate();
  const { setCurrentTeam } = useTeamContext();

  const mutation = useMutation(createTeam, {
    onSuccess: (newTeam) => {
      setCurrentTeam(newTeam.id);
      navigate("/dashboard");
      toast({ title: "Team created successfully!" });
    },
  });

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
  });

  const onSubmit = (data: TeamFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Create New Team</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="The Sluggers" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="league"
            render={({ field }) => (
              <FormItem>
                <FormLabel>League</FormLabel>
                <FormControl>
                  <Input placeholder="Vancouver Slo-Pitch League" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="season"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Season</FormLabel>
                <FormControl>
                  <Input placeholder="Summer 2024" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="A fun recreational team..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={mutation.isLoading}>
            Create Team
          </Button>
        </form>
      </Form>
    </div>
  );
};
```

### Team Invitation System

```tsx
// src/components/InviteMemberDialog.tsx
export const InviteMemberDialog = ({ teamId }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    defaultValues: { email: "", role: "player" },
  });

  const mutation = useMutation((data) => inviteMember(teamId, data), {
    onSuccess: () => {
      toast({ title: "Invitation sent!" });
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(mutation.mutate)}
          className="space-y-4"
        >
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              {...form.register("email")}
              placeholder="player@example.com"
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select {...form.register("role")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={mutation.isLoading}>
            Send Invitation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// src/pages/AcceptInvitation.tsx
export const AcceptInvitation = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data: invitation, isLoading } = useQuery(["invitation", token], () =>
    fetchInvitation(token)
  );

  const mutation = useMutation(() => acceptInvitation(token), {
    onSuccess: () => {
      navigate("/dashboard");
      toast({ title: "Welcome to the team!" });
    },
  });

  if (isLoading) return <LoadingSpinner />;

  if (invitation?.acceptedAt) {
    return <div>This invitation has already been accepted.</div>;
  }

  return (
    <div className="container max-w-md mx-auto p-4 mt-12">
      <Card>
        <CardHeader>
          <CardTitle>Team Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            You've been invited to join <strong>{invitation.team.name}</strong>
          </p>
          <p className="text-sm text-gray-600 mb-4">
            League: {invitation.team.league}
            <br />
            Season: {invitation.team.season}
            <br />
            Role: {invitation.role}
          </p>
          <Button onClick={() => mutation.mutate()} className="w-full">
            Accept Invitation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Team Roster Management

```tsx
// src/pages/admin/TeamRoster.tsx
export const TeamRoster = () => {
  const { currentTeam, isAdmin } = useTeamContext();
  const { data: members } = useQuery(["team-members", currentTeam.id], () =>
    fetchTeamMembers(currentTeam.id)
  );

  const updateRoleMutation = useMutation(({ memberId, role }) =>
    updateMemberRole(currentTeam.id, memberId, role)
  );

  const removeMemberMutation = useMutation((memberId) =>
    removeMember(currentTeam.id, memberId)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Team Roster</h1>
        {isAdmin && <InviteMemberDialog teamId={currentTeam.id} />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {isAdmin && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members?.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{member.user.name}</TableCell>
              <TableCell>{member.user.email}</TableCell>
              <TableCell>{member.gender}</TableCell>
              <TableCell>
                {isAdmin ? (
                  <Select
                    value={member.role}
                    onValueChange={(role) =>
                      updateRoleMutation.mutate({ memberId: member.id, role })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="pitcher">Pitcher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge>{member.role}</Badge>
                )}
              </TableCell>
              <TableCell>
                {new Date(member.joinedAt).toLocaleDateString()}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

---

## Database Schema (Multi-Team)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    league VARCHAR(255),
    season VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members (junction table with additional attributes)
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gender VARCHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    role VARCHAR(50) NOT NULL DEFAULT 'player',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    UNIQUE(team_id, user_id, is_active)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_active ON team_members(team_id, is_active);

-- Team member preferences
CREATE TABLE team_member_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    position VARCHAR(10) NOT NULL,
    preference_rank INT NOT NULL CHECK (preference_rank BETWEEN 1 AND 3),
    UNIQUE(team_member_id, position),
    UNIQUE(team_member_id, preference_rank)
);

CREATE INDEX idx_preferences_team_member ON team_member_preferences(team_member_id);

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time VARCHAR(20),
    location VARCHAR(255),
    opposing_team VARCHAR(255),
    final_score INT,
    opponent_score INT,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_team_id ON games(team_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_games_team_date ON games(team_id, date);

-- Attendance
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('going', 'not_going', 'maybe')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_member_id, game_id)
);

CREATE INDEX idx_attendance_game_id ON attendance(game_id);
CREATE INDEX idx_attendance_member_id ON attendance(team_member_id);

-- Batting orders
CREATE TABLE batting_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    batting_position INT NOT NULL,
    is_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, batting_position),
    UNIQUE(game_id, team_member_id)
);

CREATE INDEX idx_batting_orders_game_id ON batting_orders(game_id);

-- Fielding lineups
CREATE TABLE fielding_lineups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    inning INT NOT NULL CHECK (inning BETWEEN 1 AND 7),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    position VARCHAR(10) NOT NULL,
    is_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, inning, position),
    UNIQUE(game_id, inning, team_member_id)
);

CREATE INDEX idx_fielding_lineups_game_id ON fielding_lineups(game_id);

-- Inning scores
CREATE TABLE inning_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    inning INT NOT NULL CHECK (inning BETWEEN 1 AND 7),
    score INT NOT NULL DEFAULT 0,
    UNIQUE(game_id, inning)
);

CREATE INDEX idx_inning_scores_game_id ON inning_scores(game_id);

-- Invitations
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'player',
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_team_id ON invitations(team_id);
CREATE INDEX idx_invitations_email ON invitations(email);
```

---

## Development Phases (Multi-Team)

### Phase 1: Foundation (Week 1-2)

- [ ] Set up DigitalOcean droplet
- [ ] Configure Nginx reverse proxy and SSL
- [ ] Set up Go project structure
- [ ] Multi-team database schema & migrations
- [ ] User authentication system (JWT)
- [ ] Team creation and management
- [ ] Team membership system
- [ ] React app scaffolding with team context
- [ ] Docker Compose for local development

### Phase 2: Team Management (Week 3)

- [ ] Team invitation system (backend + frontend)
- [ ] Team member management (add/remove/roles)
- [ ] Team selector UI component
- [ ] Team context provider
- [ ] Multi-team dashboard
- [ ] Accept invitation flow

### Phase 3: Core Game Features (Week 4-5)

- [ ] Game CRUD (team-scoped)
- [ ] Attendance system (team member scoped)
- [ ] Game schedule view per team
- [ ] Team-specific preferences

### Phase 4: Lineup Management (Week 6-7)

- [ ] Lineup generation algorithms (team-aware)
- [ ] Drag-drop lineup editor
- [ ] Fielding position assignment
- [ ] Validation rules UI
- [ ] Copy lineup across innings

### Phase 5: Scoring & Polish (Week 8)

- [ ] Score tracking (total and by inning)
- [ ] Game status management
- [ ] UI/UX refinement
- [ ] Mobile responsiveness
- [ ] Error handling and loading states

### Phase 6: Testing & Deployment (Week 9)

- [ ] Unit tests for multi-team logic
- [ ] Integration tests
- [ ] E2E tests for critical flows
- [ ] Production deployment
- [ ] Performance optimization
- [ ] Monitoring and logging

---

## Agentic Development Instructions

## Context for AI Assistant

You are building a **multi-team** slo-pitch softball team management platform with the following key aspects:

### Multi-Team Architecture

1. **Users** can belong to multiple teams
2. **Teams** are isolated - no data sharing between teams
3. **Team Members** represent a user's membership in a specific team (with team-specific gender, role, preferences)
4. **All operations** are scoped to a team (games, lineups, attendance)
5. **Permissions** are team-specific (admin on Team A, player on Team B)

### Critical Business Rules

1. **Batting Order**: Must alternate M-F per team member gender. If unequal, majority gender bats consecutively ONCE.
2. **Pitchers**: Identified by TeamMember.Role containing "pitcher". Space them apart in batting order.
3. **Fielding**: 9 team members per inning with 5-4 gender split.
4. **Innings**: 7 innings per game.

### Technical Stack

- **Backend**: Go with Chi router, GORM, PostgreSQL
- **Frontend**: React + TypeScript, Vite, shadcn/ui, React Query
- **Hosting**: DigitalOcean Droplet with Nginx
- **Auth**: JWT-based (user-level)

### Key Data Model Changes

- **User** → Authentication and account
- **Team** → Teams that users can join
- **TeamMember** → User's membership in a team (has gender, role, preferences)
- **TeamMemberPreference** → Team-specific position preferences
- All game-related entities reference **TeamMember** (not User or Player)

---

## Step-by-Step Development Tasks

### Task 1: Multi-Team Database Schema

**Goal**: Create PostgreSQL schema with multi-team support

```sql
-- Key tables to create:
-- users (id, name, email, password_hash)
-- teams (id, name, description, league, season, is_active)
-- team_members (id, team_id, user_id, gender, role, is_active, joined_at, left_at)
-- team_member_preferences (id, team_member_id, position, preference_rank)
-- games (id, team_id, date, time, location, opposing_team, ...)
-- attendance (id, team_member_id, game_id, status)
-- batting_orders (id, game_id, team_member_id, batting_position)
-- fielding_lineups (id, game_id, inning, team_member_id, position)
-- inning_scores (id, game_id, inning, score)
-- invitations (id, team_id, email, token, role, expires_at, accepted_at)

-- Important indexes:
-- team_members(team_id, is_active)
-- games(team_id, date)
-- attendance(game_id), attendance(team_member_id)
```

**GORM Models**:

```go
// Ensure proper relationships and constraints
type TeamMember struct {
    ID       uuid.UUID
    TeamID   uuid.UUID `gorm:"index"`
    UserID   uuid.UUID `gorm:"index"`
    Gender   string
    Role     string
    IsActive bool
    JoinedAt time.Time
    LeftAt   *time.Time

    Team        Team                    `gorm:"foreignKey:TeamID"`
    User        User                    `gorm:"foreignKey:UserID"`
    Preferences []TeamMemberPreference  `gorm:"foreignKey:TeamMemberID"`
}

// Composite unique constraint
// gorm:"uniqueIndex:idx_team_user_active,where:is_active = true"
```

---

### Task 2: Team Management System

**Goal**: Create, edit, and manage teams

**Backend Handlers**:

```go
// internal/handlers/team.go
func CreateTeam(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("userID").(string)

    var req struct {
        Name        string `json:"name"`
        Description string `json:"description"`
        League      string `json:"league"`
        Season      string `json:"season"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Create team
    team := models.Team{
        Name:        req.Name,
        Description: req.Description,
        League:      req.League,
        Season:      req.Season,
        IsActive:    true,
    }
    db.Create(&team)

    // Add creator as admin
    membership := models.TeamMember{
        TeamID:   team.ID,
        UserID:   uuid.MustParse(userID),
        Role:     "admin",
        IsActive: true,
        JoinedAt: time.Now(),
    }
    db.Create(&membership)

    json.NewEncoder(w).Encode(team)
}

func GetMyTeams(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("userID").(string)

    var teams []models.Team
    db.Joins("JOIN team_members ON team_members.team_id = teams.id").
        Where("team_members.user_id = ? AND team_members.is_active = ?", userID, true).
        Preload("Members", "is_active = ?", true).
        Find(&teams)

    // Add membership info to each team
    for i := range teams {
        var membership models.TeamMember
        db.Where("team_id = ? AND user_id = ?", teams[i].ID, userID).
            First(&membership)
        teams[i].Membership = membership
    }

    json.NewEncoder(w).Encode(teams)
}
```

**Frontend**:

```tsx
// src/pages/MyTeams.tsx - Already provided above
// src/pages/CreateTeam.tsx - Already provided above
```

---

### Task 3: Team Invitation System

**Goal**: Invite users to teams, accept invitations

**Backend**:

```go
// internal/handlers/invitation.go
func InviteMember(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")
    userID := r.Context().Value("userID").(string)

    var req struct {
        Email string `json:"email"`
        Role  string `json:"role"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Generate unique token
    token := generateSecureToken()

    // Create invitation
    invitation := models.Invitation{
        TeamID:    uuid.MustParse(teamID),
        Email:     req.Email,
        Token:     token,
        Role:      req.Role,
        ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
        CreatedBy: uuid.MustParse(userID),
    }
    db.Create(&invitation)

    // Send email with invitation link
    sendInvitationEmail(req.Email, token, teamID)

    json.NewEncoder(w).Encode(invitation)
}

func AcceptInvitation(w http.ResponseWriter, r *http.Request) {
    token := chi.URLParam(r, "token")
    userID := r.Context().Value("userID").(string)

    var invitation models.Invitation
    result := db.Where("token = ? AND expires_at > ? AND accepted_at IS NULL",
        token, time.Now()).
        Preload("Team").
        First(&invitation)

    if result.Error != nil {
        http.Error(w, "Invalid or expired invitation", http.StatusBadRequest)
        return
    }

    // Create team membership
    membership := models.TeamMember{
        TeamID:   invitation.TeamID,
        UserID:   uuid.MustParse(userID),
        Role:     invitation.Role,
        IsActive: true,
        JoinedAt: time.Now(),
    }
    db.Create(&membership)

    // Mark invitation as accepted
    db.Model(&invitation).Update("accepted_at", time.Now())

    json.NewEncoder(w).Encode(membership)
}
```

**Email Template**:

```go
func sendInvitationEmail(email, token, teamID string) {
    link := fmt.Sprintf("https://yourdomain.com/invitations/%s", token)

    // Use email service (SendGrid, AWS SES, etc.)
    // For development, just log it
    log.Printf("Invitation link: %s", link)
}
```

---

### Task 4: Team Context & Scoping

**Goal**: All operations properly scoped to selected team

**Middleware**:

```go
// internal/middleware/team.go - Already provided above

// Usage in routes:
r.Route("/api/teams/{team_id}", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Use(middleware.RequireTeamMembership) // Validates and adds membership to context

    r.Get("/games", handlers.GetTeamGames)

    r.Group(func(r chi.Router) {
        r.Use(middleware.RequireTeamAdmin) // Checks membership.Role == "admin"
        r.Post("/games", handlers.CreateGame)
    })
})
```

**Frontend Context**:

```tsx
// src/contexts/TeamContext.tsx - Already provided above

// Usage in components:
const GamesList = () => {
  const { currentTeam, isAdmin } = useTeamContext();
  const { data: games } = useQuery(["games", currentTeam.id], () =>
    fetchGames(currentTeam.id)
  );

  // All API calls include team ID
  // UI adapts based on isAdmin
};
```

---

### Task 5: Team Member Management

**Goal**: Admin can manage team roster

**Backend**:

```go
// internal/handlers/team_member.go
func GetTeamMembers(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")

    var members []models.TeamMember
    db.Where("team_id = ? AND is_active = ?", teamID, true).
        Preload("User").
        Preload("Preferences").
        Find(&members)

    json.NewEncoder(w).Encode(members)
}

func UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")
    memberID := chi.URLParam(r, "member_id")

    var req struct {
        Role string `json:"role"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    db.Model(&models.TeamMember{}).
        Where("id = ? AND team_id = ?", memberID, teamID).
        Update("role", req.Role)

    w.WriteHeader(http.StatusOK)
}

func RemoveMember(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")
    memberID := chi.URLParam(r, "member_id")

    // Soft delete
    db.Model(&models.TeamMember{}).
        Where("id = ? AND team_id = ?", memberID, teamID).
        Updates(map[string]interface{}{
            "is_active": false,
            "left_at":   time.Now(),
        })

    w.WriteHeader(http.StatusOK)
}
```

**Frontend**:

```tsx
// src/pages/admin/TeamRoster.tsx - Already provided above
```

---

### Task 6: Team-Scoped Games & Attendance

**Goal**: Games and attendance tied to teams

**Backend**:

```go
// internal/handlers/game.go
func CreateGame(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")

    var req struct {
        Date         time.Time `json:"date"`
        Time         string    `json:"time"`
        Location     string    `json:"location"`
        OpposingTeam string    `json:"opposing_team"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    game := models.Game{
        TeamID:       uuid.MustParse(teamID),
        Date:         req.Date,
        Time:         req.Time,
        Location:     req.Location,
        OpposingTeam: req.OpposingTeam,
        Status:       "scheduled",
    }
    db.Create(&game)

    json.NewEncoder(w).Encode(game)
}

// internal/handlers/attendance.go
func UpdateAttendance(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "game_id")
    membership := r.Context().Value("teamMembership").(models.TeamMember)

    var req struct {
        Status string `json:"status"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Upsert attendance
    var attendance models.Attendance
    result := db.Where("team_member_id = ? AND game_id = ?",
        membership.ID, gameID).
        First(&attendance)

    if result.Error != nil {
        // Create new
        attendance = models.Attendance{
            TeamMemberID: membership.ID,
            GameID:       uuid.MustParse(gameID),
            Status:       req.Status,
        }
        db.Create(&attendance)
    } else {
        // Update existing
        db.Model(&attendance).Update("status", req.Status)
    }

    json.NewEncoder(w).Encode(attendance)
}
```

---

### Task 7: Team-Specific Preferences

**Goal**: Position preferences per team

**Backend**:

```go
// internal/handlers/preferences.go
func UpdateMyPreferences(w http.ResponseWriter, r *http.Request) {
    teamID := chi.URLParam(r, "team_id")
    membership := r.Context().Value("teamMembership").(models.TeamMember)

    var req struct {
        Positions []string `json:"positions"` // Up to 3
    }
    json.NewDecoder(r.Body).Decode(&req)

    if len(req.Positions) > 3 {
        http.Error(w, "Maximum 3 positions", http.StatusBadRequest)
        return
    }

    // Delete existing preferences
    db.Where("team_member_id = ?", membership.ID).
        Delete(&models.TeamMemberPreference{})

    // Create new preferences
    for i, pos := range req.Positions {
        pref := models.TeamMemberPreference{
            TeamMemberID:   membership.ID,
            Position:       pos,
            PreferenceRank: i + 1,
        }
        db.Create(&pref)
    }

    w.WriteHeader(http.StatusOK)
}
```

**Frontend**:

```tsx
// src/pages/Profile.tsx
export const Profile = () => {
  const { currentTeam, membership } = useTeamContext();
  const [positions, setPositions] = useState<string[]>([]);

  const { data: preferences } = useQuery(["preferences", membership.id], () =>
    fetchPreferences(membership.id)
  );

  useEffect(() => {
    if (preferences) {
      setPositions(preferences.map((p) => p.position));
    }
  }, [preferences]);

  const mutation = useMutation(
    () => updatePreferences(currentTeam.id, positions),
    {
      onSuccess: () => toast({ title: "Preferences saved!" }),
    }
  );

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">
        Preferences for {currentTeam.name}
      </h2>

      <PositionSelector selected={positions} onChange={setPositions} max={3} />

      <Button onClick={() => mutation.mutate()} className="mt-4">
        Save Preferences
      </Button>
    </div>
  );
};
```

---

### Task 8: Multi-Team Lineup Generation

**Goal**: Lineups use team members, not users

**Backend** (already updated above):

```go
// Key changes:
// - Filter by team_member.is_active
// - Use team_member.gender (not user.gender)
// - Check team_member.role for pitcher
// - Use team_member_preferences for position assignment
// - Return TeamMemberID in lineup records
```

**Frontend**:

```tsx
// src/components/LineupDisplay.tsx
export const LineupDisplay = ({ gameId }) => {
  const { data: battingOrder } = useQuery(["batting-order", gameId], () =>
    fetchBattingOrder(gameId)
  );

  return (
    <div>
      <h3 className="font-bold mb-2">Batting Order</h3>
      <ol className="space-y-2">
        {battingOrder?.map((order, idx) => (
          <li key={order.id} className="flex items-center gap-2">
            <span className="font-bold">{idx + 1}.</span>
            <span>{order.teamMember.user.name}</span>
            <Badge variant="secondary">{order.teamMember.gender}</Badge>
            {order.teamMember.role.includes("pitcher") && <Badge>P</Badge>}
          </li>
        ))}
      </ol>
    </div>
  );
};
```

---

## Testing Strategy (Multi-Team)

### Backend Tests

- [ ] User can belong to multiple teams
- [ ] Team member has correct team-specific attributes
- [ ] Invitation flow creates membership correctly
- [ ] Lineup generation uses team members, not users
- [ ] Team scoping prevents cross-team data access
- [ ] Admin on one team is player on another
- [ ] Soft delete preserves historical data

### Frontend Tests

- [ ] Team selector switches context correctly
- [ ] API calls include correct team ID
- [ ] UI adapts based on team-specific role
- [ ] Preferences are team-specific
- [ ] Cannot access other team's data

### Integration Tests

- [ ] Create team → invite member → accept → join
- [ ] User switches between teams
- [ ] Admin creates game → players set attendance → lineups generated
- [ ] Cross-team isolation verified

---

## Migration from Single-Team

If you have existing single-team data to migrate:

```sql
-- Create default team
INSERT INTO teams (id, name, league, season, is_active)
VALUES ('default-team-uuid', 'Main Team', 'Local League', 'Current', true);

-- Migrate players to team_members
INSERT INTO team_members (id, team_id, user_id, gender, role, is_active, joined_at)
SELECT
    gen_random_uuid(),
    'default-team-uuid',
    id,
    gender,
    CASE WHEN is_admin THEN 'admin'
         WHEN is_pitcher THEN 'pitcher'
         ELSE 'player' END,
    true,
    created_at
FROM players;

-- Migrate player preferences to team_member_preferences
-- ... similar migration queries
```

---

## Deployment Considerations (Multi-Team)

### Performance

- Add indexes on team_id columns
- Use connection pooling
- Cache frequently accessed team data
- Implement pagination for large rosters

### Scalability

- Horizontal scaling ready (stateless backend)
- Team data can be sharded by team_id if needed
- Consider read replicas for reporting

### Monitoring

- Track teams created per day
- Monitor invitation acceptance rate
- Alert on cross-team data access attempts
