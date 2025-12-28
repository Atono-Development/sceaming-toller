# Slo-Pitch Softball Team Manager - Product Plan

## Project Overview

A web application for managing a recreational slo-pitch softball team with gender-balanced lineup requirements, attendance tracking, and game management.

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

## Data Model

### Core Entities

```go
type Player struct {
    ID                 uuid.UUID
    Name              string
    Email             string
    PasswordHash      string
    Gender            string // "M" or "F"
    IsAdmin           bool
    IsPitcher         bool
    PreferredPositions []string // max 3, stored as JSONB or separate table
    CreatedAt         time.Time
    UpdatedAt         time.Time
}

type Game struct {
    ID              uuid.UUID
    Date            time.Time
    Time            string
    Location        string
    OpposingTeam    string
    FinalScore      *int // nullable
    OpponentScore   *int // nullable
    Status          string // "scheduled", "in_progress", "completed"
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type Attendance struct {
    ID         uuid.UUID
    PlayerID   uuid.UUID
    GameID     uuid.UUID
    Status     string // "going", "not_going", "maybe"
    UpdatedAt  time.Time
}

type BattingOrder struct {
    ID              uuid.UUID
    GameID          uuid.UUID
    PlayerID        uuid.UUID
    BattingPosition int // 1-12+
    IsGenerated     bool
    CreatedAt       time.Time
}

type FieldingLineup struct {
    ID          uuid.UUID
    GameID      uuid.UUID
    Inning      int // 1-7
    PlayerID    uuid.UUID
    Position    string // "1B", "2B", "3B", "SS", "LF", "CF", "RF", "C", "Rover"
    IsGenerated bool
    CreatedAt   time.Time
}

type InningScore struct {
    ID      uuid.UUID
    GameID  uuid.UUID
    Inning  int // 1-7
    Score   int
}
```

---

## Feature Specifications

### 1. Admin Features

#### 1.1 Game Management

- **Create Game**: Form with date, time, location, opposing team
- **Edit Game**: Update details
- **Delete Game**: Remove scheduled game
- **Record Final Score**: Input total score (team & opponent)
- **Record Inning Scores**: Input score per inning (1-7)

#### 1.2 Lineup Management

- **Auto-Generate Batting Order**:
  - Algorithm:
    1. Filter players with "going" attendance
    2. Separate by gender
    3. Alternate M-F starting with the gender with more players
    4. If unequal, place extra players together once in order
    5. Identify pitchers, space them apart (if only 2 pitchers, place them at opposite ends)
  - Mark as generated (editable afterward)
- **Auto-Generate Fielding Lineup**:
  - Algorithm:
    1. Get confirmed players
    2. Select 9 players ensuring 5-4 gender split
    3. Assign positions based on preferences
    4. Fill remaining positions
    5. Create lineup for inning 1 (can be copied/modified for other innings)
- **Manual Editing**:
  - Drag-and-drop reordering
  - Swap players
  - Change positions
  - Validate M-F alternation in batting order
  - Validate 5-4 gender split in fielding

#### 1.3 Player Management

- Add/remove players
- Set pitcher designation
- Set admin privileges
- View player preferences

### 2. Player Features

#### 2.1 Attendance

- View upcoming games
- Set attendance status (going/not going/maybe)
- See who else is attending

#### 2.2 Preferences

- Select up to 3 preferred positions
- View personal stats (future enhancement)

#### 2.3 View Lineups

- See batting order for games they're attending
- See fielding positions by inning
- View game schedule

---

## User Flows

### Admin Flow: Create Game & Generate Lineup

```
1. Navigate to "Schedule" → "Add Game"
2. Fill in game details (date, time, location, opponent)
3. Click "Save Game"
4. Players receive notification (optional)
5. Wait for attendance confirmation
6. Navigate to game details
7. Click "Generate Batting Order"
   → System creates alternating M-F order
   → Pitchers spaced appropriately
8. Review and manually adjust if needed
9. Click "Generate Fielding Lineup"
   → System assigns based on preferences
10. Adjust positions/innings as needed
11. Publish lineup (players can view)
```

### Player Flow: Confirm Attendance & View Lineup

```
1. Receive notification of new game (or check schedule)
2. Navigate to "Games"
3. Click on upcoming game
4. Set attendance: "Going" / "Not Going" / "Maybe"
5. After admin generates lineup:
   → View batting position
   → View fielding position(s) by inning
```

---

## Algorithm Details

### Batting Order Generation

```go
func GenerateBattingOrder(players []Player, pitchers []uuid.UUID) ([]BattingPosition, error) {
    confirmed := filterByAttendance(players, "going")

    if len(confirmed) < 9 {
        return nil, errors.New("insufficient players: need at least 9 confirmed")
    }

    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    var order []BattingPosition

    // Alternate starting with majority gender
    if len(males) >= len(females) {
        order = alternateGenders(males, females)
    } else {
        order = alternateGenders(females, males)
    }

    // Space out pitchers if exactly 2
    if len(pitchers) == 2 {
        order = spacePitchers(order, pitchers)
    }

    return order, nil
}

func alternateGenders(majority, minority []Player) []BattingPosition {
    order := make([]BattingPosition, 0, len(majority)+len(minority))

    majorityIdx := 0
    minorityIdx := 0
    position := 1
    consecutiveUsed := false

    for majorityIdx < len(majority) || minorityIdx < len(minority) {
        // Add from majority
        if majorityIdx < len(majority) {
            order = append(order, BattingPosition{
                PlayerID: majority[majorityIdx].ID,
                Position: position,
            })
            majorityIdx++
            position++
        }

        // Add from minority
        if minorityIdx < len(minority) {
            order = append(order, BattingPosition{
                PlayerID: minority[minorityIdx].ID,
                Position: position,
            })
            minorityIdx++
            position++
        } else if !consecutiveUsed && majorityIdx < len(majority) {
            // If no minority left and we haven't used consecutive yet
            // Add one more from majority
            order = append(order, BattingPosition{
                PlayerID: majority[majorityIdx].ID,
                Position: position,
            })
            majorityIdx++
            position++
            consecutiveUsed = true
        }
    }

    return order
}

func spacePitchers(order []BattingPosition, pitchers []uuid.UUID) []BattingPosition {
    // Find pitchers in order
    pitcher1Idx := -1
    pitcher2Idx := -1

    for i, pos := range order {
        if pos.PlayerID == pitchers[0] {
            pitcher1Idx = i
        }
        if pos.PlayerID == pitchers[1] {
            pitcher2Idx = i
        }
    }

    if pitcher1Idx == -1 || pitcher2Idx == -1 {
        return order // Pitcher not in confirmed list
    }

    // Calculate optimal spacing (half the lineup)
    optimalDistance := len(order) / 2
    currentDistance := abs(pitcher2Idx - pitcher1Idx)

    // If they're too close, swap pitcher2 with player at optimal position
    if currentDistance < optimalDistance-1 {
        targetIdx := (pitcher1Idx + optimalDistance) % len(order)
        order[pitcher2Idx], order[targetIdx] = order[targetIdx], order[pitcher2Idx]
    }

    return order
}

func abs(x int) int {
    if x < 0 {
        return -x
    }
    return x
}
```

### Fielding Lineup Generation

```go
func GenerateFieldingLineup(players []Player, inning int) ([]FieldingAssignment, error) {
    confirmed := filterByAttendance(players, "going")

    if len(confirmed) < 9 {
        return nil, errors.New("insufficient players: need at least 9 confirmed")
    }

    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    // Select 9 players with 5-4 split
    var selected []Player
    if len(males) >= 5 && len(females) >= 4 {
        selected = append(selectN(males, 5), selectN(females, 4)...)
    } else if len(females) >= 5 && len(males) >= 4 {
        selected = append(selectN(females, 5), selectN(males, 4)...)
    } else {
        return nil, errors.New("cannot achieve 5-4 gender split with available players")
    }

    positions := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"}

    assignments := make([]FieldingAssignment, 0, 9)
    assignedPlayers := make(map[uuid.UUID]bool)
    assignedPositions := make(map[string]bool)

    // First pass: assign preferred positions
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, player := range selected {
            if assignedPlayers[player.ID] {
                continue
            }

            if contains(player.PreferredPositions, pos) {
                assignments = append(assignments, FieldingAssignment{
                    PlayerID: player.ID,
                    Position: pos,
                    Inning:   inning,
                })
                assignedPlayers[player.ID] = true
                assignedPositions[pos] = true
                break
            }
        }
    }

    // Second pass: fill remaining positions
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, player := range selected {
            if assignedPlayers[player.ID] {
                continue
            }

            assignments = append(assignments, FieldingAssignment{
                PlayerID: player.ID,
                Position: pos,
                Inning:   inning,
            })
            assignedPlayers[player.ID] = true
            assignedPositions[pos] = true
            break
        }
    }

    return assignments, nil
}

func selectN(players []Player, n int) []Player {
    if len(players) <= n {
        return players
    }
    return players[:n]
}

func contains(slice []string, item string) bool {
    for _, s := range slice {
        if s == item {
            return true
        }
    }
    return false
}
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
```

### Players

```
GET    /api/players
POST   /api/players (admin)
GET    /api/players/:id
PUT    /api/players/:id (admin or self for preferences only)
DELETE /api/players/:id (admin)
PUT    /api/players/:id/preferences (self)
PUT    /api/players/:id/pitcher (admin)
```

### Games

```
GET    /api/games
POST   /api/games (admin)
GET    /api/games/:id
PUT    /api/games/:id (admin)
DELETE /api/games/:id (admin)
```

### Attendance

```
GET    /api/games/:id/attendance
PUT    /api/games/:id/attendance (player sets their own)
GET    /api/games/:id/attendance/summary (admin - see all)
```

### Lineups

```
POST   /api/games/:id/batting-order/generate (admin)
GET    /api/games/:id/batting-order
PUT    /api/games/:id/batting-order (admin - manual edit)
DELETE /api/games/:id/batting-order (admin - clear)

POST   /api/games/:id/fielding/generate (admin)
GET    /api/games/:id/fielding
PUT    /api/games/:id/fielding (admin - manual edit)
DELETE /api/games/:id/fielding (admin - clear)
```

### Scoring

```
PUT    /api/games/:id/score (admin - final score)
PUT    /api/games/:id/innings/:inning/score (admin - inning score)
GET    /api/games/:id/score
```

---

## UI Components

### Admin Dashboard

- **Schedule View**: Calendar with games
- **Game Detail**:
  - Game info editor
  - Attendance list with counts
  - Lineup generator buttons
  - Lineup editors (drag-drop)
  - Score input (total and by inning)
- **Player Management**: Table of players with roles (admin/pitcher flags)

### Player Dashboard

- **Games List**: Upcoming games with attendance buttons
- **Game Detail**:
  - Game info (read-only)
  - Attendance toggle
  - Lineup view (batting position, fielding assignments by inning)
  - Score display
- **Profile**: Preferred positions selector (up to 3)

### Shared Components

- **Navigation**: Role-based menu (admin sees more options)
- **Game Card**: Display game info, attendance status, quick actions
- **Position Selector**: Multi-select for preferred positions
- **Lineup Display**: Table/grid showing positions
- **Score Card**: Inning-by-inning breakdown

---

## Development Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Set up DigitalOcean droplet
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt
- [ ] Set up Go project structure
- [ ] Database schema & migrations
- [ ] Auth system (JWT)
- [ ] Basic CRUD for Players & Games
- [ ] React app scaffolding with Vite
- [ ] Docker Compose for local development

### Phase 2: Core Features (Week 3-4)

- [ ] Attendance system (backend + frontend)
- [ ] Lineup generation algorithms
- [ ] Admin game management UI
- [ ] Player attendance UI
- [ ] Game schedule view

### Phase 3: Lineup Management (Week 5-6)

- [ ] Drag-drop lineup editor (react-beautiful-dnd or dnd-kit)
- [ ] Fielding position assignment
- [ ] Validation rules UI
- [ ] Lineup display for players
- [ ] Copy lineup across innings feature

### Phase 4: Scoring & Polish (Week 7-8)

- [ ] Score tracking (total and by inning)
- [ ] Game status management (scheduled/in-progress/completed)
- [ ] UI/UX refinement
- [ ] Mobile responsiveness
- [ ] Error handling and loading states

### Phase 5: Deployment & Testing (Week 9)

- [ ] Unit tests for lineup algorithms
- [ ] Integration tests for API
- [ ] E2E tests for critical flows
- [ ] Production deployment to DigitalOcean
- [ ] Performance optimization
- [ ] Monitoring and logging setup

---

## Testing Strategy

### Backend

- **Unit Tests**:
  - Lineup generation algorithms (multiple test cases)
  - Validation logic
  - Business rules enforcement
- **Integration Tests**:
  - API endpoints with test database
  - Authentication flows
  - CRUD operations
- **Test Framework**: Go's built-in `testing` package

### Frontend

- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright or Cypress
- **Test Cases**:
  - User login/logout
  - Set attendance
  - Generate lineup (admin)
  - Edit lineup (admin)
  - View lineup (player)

---

## DigitalOcean Deployment

### Infrastructure Setup

#### 1. Droplet Specifications

```
OS: Ubuntu 22.04 LTS
Size: Basic Droplet ($12/month minimum)
- 2 GB RAM
- 1 vCPU
- 50 GB SSD
- 2 TB transfer

Add-ons:
- Backups (recommended)
- Monitoring (free)
```

#### 2. Initial Server Setup

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Create non-root user
adduser softball
usermod -aG sudo softball
ufw allow OpenSSH
ufw enable

# Switch to new user
su - softball

# Update system
sudo apt update && sudo apt upgrade -y
```

#### 3. Install Dependencies

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Install PostgreSQL (if not using Docker for DB)
sudo apt install postgresql postgresql-contrib -y
```

#### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/softball-manager

server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/softball-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 5. Application Deployment

```bash
# Clone repository
cd /home/softball
git clone https://github.com/yourusername/softball-manager.git
cd softball-manager

# Create environment file
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/softball
JWT_SECRET=your-secret-key-here
PORT=8080
FRONTEND_URL=https://yourdomain.com
ENV=production
EOF

# Build and start with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

#### 6. Docker Compose Production Config

```yaml
# docker-compose.prod.yml

version: "3.8"

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: softball
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      - db

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: https://yourdomain.com/api
    restart: always
    ports:
      - "3000:80"

volumes:
  postgres_data:
```

#### 7. Backend Dockerfile

```dockerfile
# backend/Dockerfile

FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
```

#### 8. Frontend Dockerfile

```dockerfile
# frontend/Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 9. Frontend Nginx Config

```nginx
# frontend/nginx.conf

server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8080;
    }
}
```

#### 10. Systemd Service (Alternative to Docker)

```ini
# /etc/systemd/system/softball-backend.service

[Unit]
Description=Softball Manager Backend
After=network.target postgresql.service

[Service]
Type=simple
User=softball
WorkingDirectory=/home/softball/softball-manager/backend
ExecStart=/home/softball/softball-manager/backend/main
Restart=on-failure
Environment="DATABASE_URL=postgresql://user:password@localhost:5432/softball"
Environment="JWT_SECRET=your-secret-key"
Environment="PORT=8080"

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable softball-backend
sudo systemctl start softball-backend
sudo systemctl status softball-backend
```

#### 11. Automated Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Pulling latest code..."
git pull origin main

echo "Stopping services..."
docker-compose -f docker-compose.prod.yml down

echo "Building images..."
docker-compose -f docker-compose.prod.yml build

echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "Running migrations..."
docker-compose -f docker-compose.prod.yml exec backend ./main migrate

echo "Deployment complete!"
```

#### 12. Backup Strategy

```bash
# Automated daily backups

# /home/softball/backup.sh
#!/bin/bash

BACKUP_DIR="/home/softball/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker exec softball-manager_db_1 pg_dump -U user softball > "$BACKUP_DIR/db_$DATE.sql"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete

# Add to crontab
# 0 2 * * * /home/softball/backup.sh
```

#### 13. Monitoring

```bash
# Install monitoring tools
sudo apt install htop -y

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Monitor resources
htop

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml

name: Deploy to DigitalOcean

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: ${{ secrets.DROPLET_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/softball/softball-manager
            git pull origin main
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d --build
```

---

## File Structure

```
softball-manager/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── auth/
│   │   │   ├── jwt.go
│   │   │   ├── middleware.go
│   │   │   └── handlers.go
│   │   ├── models/
│   │   │   ├── player.go
│   │   │   ├── game.go
│   │   │   ├── attendance.go
│   │   │   └── lineup.go
│   │   ├── handlers/
│   │   │   ├── player.go
│   │   │   ├── game.go
│   │   │   ├── attendance.go
│   │   │   └── lineup.go
│   │   ├── services/
│   │   │   ├── player.go
│   │   │   ├── game.go
│   │   │   └── lineup.go
│   │   ├── repository/
│   │   │   ├── player.go
│   │   │   ├── game.go
│   │   │   └── lineup.go
│   │   └── lineup/
│   │       ├── batting.go
│   │       ├── fielding.go
│   │       └── batting_test.go
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── Dockerfile
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # shadcn components
│   │   │   ├── Layout.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── GameCard.tsx
│   │   │   ├── LineupEditor.tsx
│   │   │   └── ScoreCard.tsx
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── GameManagement.tsx
│   │   │   │   ├── PlayerManagement.tsx
│   │   │   │   └── LineupEditor.tsx
│   │   │   ├── player/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── GameList.tsx
│   │   │   │   ├── GameDetail.tsx
│   │   │   │   └── Profile.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useGames.ts
│   │   │   └── useLineup.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── games.ts
│   │   │   ├── players.ts
│   │   │   └── lineups.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .github/
│   └── workflows/
│       └── deploy.yml
├── docker-compose.yml         # Local development
├── docker-compose.prod.yml    # Production
├── .env.example
├── deploy.sh
└── README.md
```

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/softball

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRY=24h

# Server
PORT=8080
ENV=development # or production

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:8080/api
```

---

## Security Considerations

### 1. Authentication

- Use bcrypt for password hashing (cost factor 12+)
- JWT tokens with reasonable expiry (24 hours)
- HTTP-only cookies for token storage (if using cookies)
- Implement refresh token mechanism

### 2. Authorization

- Middleware to check admin role for protected routes
- Players can only modify their own attendance and preferences
- Validate user permissions on every request

### 3. Database

- Use parameterized queries (GORM handles this)
- Never expose database credentials
- Regular backups
- Enable SSL for database connections in production

### 4. API

- Rate limiting (consider using middleware)
- Input validation on all endpoints
- CORS configuration (whitelist frontend domain)
- SQL injection protection (ORM provides this)

### 5. Server

- Keep Ubuntu and packages updated
- Configure firewall (UFW)
- Disable root SSH login
- Use SSH keys instead of passwords
- Regular security audits

---

# Agentic Development Instructions

## Context for AI Assistant

You are building a slo-pitch softball team management web application with the following constraints:

### Critical Business Rules

1. **Batting Order**: Must alternate Male-Female (MFMFMF...). If genders are unequal, the majority gender may bat consecutively ONCE in the lineup.
2. **Pitchers**: The team pitches to themselves. Pitchers should be spaced as far apart as possible in the batting order (if only 2 pitchers, place them at opposite ends of the order).
3. **Fielding**: 9 positions total with a 5-4 gender split (either 5M/4F or 5F/4M). One position is "Rover" (replaces pitcher).
4. **Innings**: League plays 7 innings.

### Technical Stack

- **Backend**: Go with Chi router, GORM, PostgreSQL
- **Frontend**: React + TypeScript, Vite, shadcn/ui, React Query
- **Hosting**: DigitalOcean Droplet with Nginx
- **Auth**: JWT-based

### Data Model Priorities

- Players: ID, Name, Email, Gender (M/F), IsAdmin, IsPitcher, PreferredPositions (max 3)
- Games: Date, Time, Location, OpposingTeam, Scores
- Attendance: Player-Game relationship with status (going/not_going/maybe)
- Lineups: Batting order and fielding positions (per inning)

---

## Step-by-Step Development Tasks

### Task 1: Project Setup

**Goal**: Initialize Go backend and React frontend with Docker

```bash
# What to create:
# 1. Go module with Chi router
# 2. PostgreSQL connection with GORM
# 3. Docker Compose for local dev (Go, React, Postgres)
# 4. Vite React app with TypeScript
# 5. Basic project structure as outlined above

# Acceptance criteria:
- `docker-compose up` starts all services
- Go server responds at localhost:8080/health
- React dev server runs at localhost:5173
- Database connection established
```

**Files to create**:

- `backend/cmd/server/main.go` - Entry point with Chi router setup
- `backend/internal/models/models.go` - All data models
- `backend/internal/database/database.go` - GORM connection
- `docker-compose.yml` - Local development services
- `frontend/vite.config.ts` - Vite configuration
- `frontend/src/main.tsx` - React entry point

**Implementation Notes**:

```go
// backend/cmd/server/main.go structure
package main

import (
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/go-chi/cors"
)

func main() {
    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(cors.Handler(cors.Options{...}))

    r.Get("/health", healthHandler)

    // Route groups
    r.Route("/api", func(r chi.Router) {
        r.Route("/auth", authRoutes)
        r.Route("/players", playerRoutes)
        r.Route("/games", gameRoutes)
    })
}
```

---

### Task 2: Database Schema & Migrations

**Goal**: Create PostgreSQL schema matching the data model

```sql
-- Tables to create:
-- players (id, name, email, password_hash, gender, is_admin, is_pitcher, preferred_positions, created_at, updated_at)
-- games (id, date, time, location, opposing_team, final_score, opponent_score, status, created_at, updated_at)
-- attendance (id, player_id, game_id, status, updated_at)
-- batting_orders (id, game_id, player_id, batting_position, is_generated, created_at)
-- fielding_lineups (id, game_id, inning, player_id, position, is_generated, created_at)
-- inning_scores (id, game_id, inning, score)
```

**Implementation**:

```go
// Use GORM AutoMigrate in main.go
db.AutoMigrate(
    &models.Player{},
    &models.Game{},
    &models.Attendance{},
    &models.BattingOrder{},
    &models.FieldingLineup{},
    &models.InningScore{},
)

// Or create migration files in migrations/ directory
```

**Validation**:

- [ ] All tables created
- [ ] Foreign keys established
- [ ] Indexes on frequently queried fields (game_id, player_id)
- [ ] UUID columns use proper type

---

### Task 3: Authentication System

**Goal**: JWT-based auth with admin/player roles

**Backend Implementation**:

```go
// internal/auth/jwt.go
package auth

type Claims struct {
    UserID  string `json:"user_id"`
    IsAdmin bool   `json:"is_admin"`
    jwt.RegisteredClaims
}

func GenerateToken(userID string, isAdmin bool) (string, error) {
    // Create token with 24h expiry
}

func ValidateToken(tokenString string) (*Claims, error) {
    // Parse and validate JWT
}

// internal/auth/middleware.go
func RequireAuth(next http.Handler) http.Handler {
    // Extract and validate JWT from Authorization header
}

func RequireAdmin(next http.Handler) http.Handler {
    // Check IsAdmin claim
}

// internal/auth/handlers.go
func RegisterHandler(w http.ResponseWriter, r *http.Request) {
    // Hash password with bcrypt
    // Create player record
    // Return JWT
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
    // Verify password
    // Generate JWT
    // Return token
}
```

**Endpoints**:

```
POST /api/auth/register
Body: { "name": "...", "email": "...", "password": "...", "gender": "M" }
Response: { "token": "...", "player": {...} }

POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "token": "...", "player": {...} }

GET /api/auth/me (requires auth)
Response: { "player": {...} }
```

**Frontend**:

```tsx
// src/api/auth.ts
export const login = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};

// src/hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Login, logout, register functions
};

// src/components/ProtectedRoute.tsx
export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && !user.isAdmin) return <Navigate to="/" />;

  return children;
};
```

---

### Task 4: Player & Game CRUD

**Goal**: Basic CRUD for players and games

**Backend Endpoints**:

```go
// internal/handlers/player.go
func GetPlayers(w http.ResponseWriter, r *http.Request) {
    // Return all players
}

func CreatePlayer(w http.ResponseWriter, r *http.Request) {
    // Admin only
    // Create new player
}

func UpdatePlayer(w http.ResponseWriter, r *http.Request) {
    // Admin can update all fields
    // Players can only update their own preferences
}

func DeletePlayer(w http.ResponseWriter, r *http.Request) {
    // Admin only
}

// internal/handlers/game.go
func GetGames(w http.ResponseWriter, r *http.Request) {
    // Return all games (optional: filter by date range)
}

func CreateGame(w http.ResponseWriter, r *http.Request) {
    // Admin only
}

func UpdateGame(w http.ResponseWriter, r *http.Request) {
    // Admin only
}

func DeleteGame(w http.ResponseWriter, r *http.Request) {
    // Admin only
}
```

**API Routes**:

```
GET    /api/players
POST   /api/players (admin)
GET    /api/players/:id
PUT    /api/players/:id (admin or self for preferences)
DELETE /api/players/:id (admin)

GET    /api/games
POST   /api/games (admin)
GET    /api/games/:id
PUT    /api/games/:id (admin)
DELETE /api/games/:id (admin)
```

**Frontend Components**:

```tsx
// src/pages/admin/PlayerManagement.tsx
export const PlayerManagement = () => {
  const { data: players } = useQuery(["players"], fetchPlayers);

  return (
    <div>
      <Button onClick={() => setShowAddModal(true)}>Add Player</Button>
      <Table>{/* Player list with edit/delete actions */}</Table>
    </div>
  );
};

// src/pages/admin/GameManagement.tsx
export const GameManagement = () => {
  const { data: games } = useQuery(["games"], fetchGames);

  return (
    <div>
      <Button onClick={() => setShowAddModal(true)}>Add Game</Button>
      {/* Calendar or list view of games */}
    </div>
  );
};
```

**Forms with Validation**:

```tsx
// src/components/PlayerForm.tsx
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const playerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  gender: z.enum(["M", "F"]),
  isAdmin: z.boolean(),
  isPitcher: z.boolean(),
});

export const PlayerForm = ({ onSubmit, initialData }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(playerSchema),
    defaultValues: initialData,
  });

  return <form onSubmit={handleSubmit(onSubmit)}>{/* Form fields */}</form>;
};
```

---

### Task 5: Attendance System

**Goal**: Players set attendance for games

**Backend**:

```go
// internal/handlers/attendance.go
func GetGameAttendance(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")
    // Return all attendance records for game
}

func UpdateAttendance(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")
    userID := r.Context().Value("userID").(string)

    var req struct {
        Status string `json:"status"` // "going", "not_going", "maybe"
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Upsert attendance record
    attendance := models.Attendance{
        PlayerID: userID,
        GameID:   gameID,
        Status:   req.Status,
    }

    // Save to DB
}

func GetAttendanceSummary(w http.ResponseWriter, r *http.Request) {
    // Admin only
    // Return count of going/not_going/maybe
}
```

**Endpoints**:

```
GET /api/games/:id/attendance
PUT /api/games/:id/attendance
GET /api/games/:id/attendance/summary (admin)
```

**Frontend**:

```tsx
// src/components/AttendanceToggle.tsx
export const AttendanceToggle = ({ gameId, currentStatus }) => {
  const mutation = useMutation((status: string) =>
    updateAttendance(gameId, status)
  );

  return (
    <div className="flex gap-2">
      <Button
        variant={currentStatus === "going" ? "default" : "outline"}
        onClick={() => mutation.mutate("going")}
      >
        Going
      </Button>
      <Button
        variant={currentStatus === "maybe" ? "default" : "outline"}
        onClick={() => mutation.mutate("maybe")}
      >
        Maybe
      </Button>
      <Button
        variant={currentStatus === "not_going" ? "default" : "outline"}
        onClick={() => mutation.mutate("not_going")}
      >
        Not Going
      </Button>
    </div>
  );
};

// src/pages/player/GameDetail.tsx
export const GameDetail = () => {
  const { id } = useParams();
  const { data: game } = useQuery(["game", id], () => fetchGame(id));
  const { data: attendance } = useQuery(["attendance", id], () =>
    fetchAttendance(id)
  );

  return (
    <div>
      <h1>{game.opposingTeam}</h1>
      <p>
        {game.date} at {game.time}
      </p>
      <AttendanceToggle gameId={id} currentStatus={attendance.status} />

      {/* Show who else is going */}
      <div>
        <h3>Confirmed: {attendance.summary.going}</h3>
        {/* List of players */}
      </div>
    </div>
  );
};
```

---

### Task 6: Batting Order Generation Algorithm

**Goal**: Auto-generate batting order following rules

**Backend Implementation**:

```go
// internal/lineup/batting.go
package lineup

import (
    "errors"
    "github.com/google/uuid"
)

type BattingPosition struct {
    PlayerID uuid.UUID
    Position int
}

func GenerateBattingOrder(
    players []models.Player,
    pitchers []uuid.UUID,
) ([]models.BattingOrder, error) {
    // 1. Filter players with "going" attendance
    confirmed := filterByAttendance(players, "going")

    if len(confirmed) < 9 {
        return nil, errors.New("insufficient players: need at least 9 confirmed")
    }

    // 2. Separate by gender
    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    // 3. Alternate M-F
    var positions []BattingPosition
    if len(males) >= len(females) {
        positions = alternateGenders(males, females)
    } else {
        positions = alternateGenders(females, males)
    }

    // 4. Space out pitchers
    if len(pitchers) == 2 {
        positions = spacePitchers(positions, pitchers)
    }

    // 5. Convert to BattingOrder models
    result := make([]models.BattingOrder, len(positions))
    for i, pos := range positions {
        result[i] = models.BattingOrder{
            PlayerID:        pos.PlayerID,
            BattingPosition: pos.Position,
            IsGenerated:     true,
        }
    }

    return result, nil
}

func alternateGenders(majority, minority []models.Player) []BattingPosition {
    positions := make([]BattingPosition, 0)
    majorityIdx := 0
    minorityIdx := 0
    position := 1
    consecutiveUsed := false

    for majorityIdx < len(majority) || minorityIdx < len(minority) {
        // Add from majority
        if majorityIdx < len(majority) {
            positions = append(positions, BattingPosition{
                PlayerID: majority[majorityIdx].ID,
                Position: position,
            })
            majorityIdx++
            position++
        }

        // Add from minority
        if minorityIdx < len(minority) {
            positions = append(positions, BattingPosition{
                PlayerID: minority[minorityIdx].ID,
                Position: position,
            })
            minorityIdx++
            position++
        } else if !consecutiveUsed && majorityIdx < len(majority) {
            // Allow one consecutive from majority
            positions = append(positions, BattingPosition{
                PlayerID: majority[majorityIdx].ID,
                Position: position,
            })
            majorityIdx++
            position++
            consecutiveUsed = true
        }
    }

    return positions
}

func spacePitchers(order []BattingPosition, pitchers []uuid.UUID) []BattingPosition {
    if len(pitchers) != 2 {
        return order
    }

    // Find pitcher positions
    pitcher1Idx := -1
    pitcher2Idx := -1

    for i, pos := range order {
        if pos.PlayerID == pitchers[0] {
            pitcher1Idx = i
        }
        if pos.PlayerID == pitchers[1] {
            pitcher2Idx = i
        }
    }

    if pitcher1Idx == -1 || pitcher2Idx == -1 {
        return order // Pitcher not in lineup
    }

    // Calculate optimal spacing (opposite ends)
    optimalDistance := len(order) / 2
    currentDistance := abs(pitcher2Idx - pitcher1Idx)

    // If too close, swap pitcher2 to opposite end
    if currentDistance < optimalDistance-1 {
        targetIdx := (pitcher1Idx + optimalDistance) % len(order)
        order[pitcher2Idx], order[targetIdx] = order[targetIdx], order[pitcher2Idx]
    }

    return order
}

func abs(x int) int {
    if x < 0 {
        return -x
    }
    return x
}

func filterByGender(players []models.Player, gender string) []models.Player {
    result := make([]models.Player, 0)
    for _, p := range players {
        if p.Gender == gender {
            result = append(result, p)
        }
    }
    return result
}
```

**Handler**:

```go
// internal/handlers/lineup.go
func GenerateBattingOrderHandler(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")

    // Get all players with "going" attendance for this game
    var attendees []models.Player
    db.Joins("JOIN attendance ON attendance.player_id = players.id").
        Where("attendance.game_id = ? AND attendance.status = ?", gameID, "going").
        Find(&attendees)

    // Get pitcher IDs
    var pitchers []models.Player
    db.Where("is_pitcher = ?", true).Find(&pitchers)
    pitcherIDs := make([]uuid.UUID, len(pitchers))
    for i, p := range pitchers {
        pitcherIDs[i] = p.ID
    }

    // Generate batting order
    order, err := lineup.GenerateBattingOrder(attendees, pitcherIDs)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // Save to database (delete existing, insert new)
    db.Where("game_id = ?", gameID).Delete(&models.BattingOrder{})
    for i := range order {
        order[i].GameID = uuid.MustParse(gameID)
        db.Create(&order[i])
    }

    json.NewEncoder(w).Encode(order)
}
```

**Tests**:

```go
// internal/lineup/batting_test.go
package lineup

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestGenerateBattingOrder_EqualGenders(t *testing.T) {
    players := []models.Player{
        {ID: uuid.New(), Gender: "M", Name: "M1"},
        {ID: uuid.New(), Gender: "F", Name: "F1"},
        {ID: uuid.New(), Gender: "M", Name: "M2"},
        {ID: uuid.New(), Gender: "F", Name: "F2"},
        {ID: uuid.New(), Gender: "M", Name: "M3"},
        {ID: uuid.New(), Gender: "F", Name: "F3"},
    }

    order, err := GenerateBattingOrder(players, []uuid.UUID{})

    assert.NoError(t, err)
    assert.Equal(t, 6, len(order))

    // Verify alternation
    for i := 0; i < len(order)-1; i++ {
        player1 := findPlayer(players, order[i].PlayerID)
        player2 := findPlayer(players, order[i+1].PlayerID)
        assert.NotEqual(t, player1.Gender, player2.Gender)
    }
}

func TestGenerateBattingOrder_MoreMales(t *testing.T) {
    players := []models.Player{
        {ID: uuid.New(), Gender: "M", Name: "M1"},
        {ID: uuid.New(), Gender: "M", Name: "M2"},
        {ID: uuid.New(), Gender: "M", Name: "M3"},
        {ID: uuid.New(), Gender: "M", Name: "M4"},
        {ID: uuid.New(), Gender: "F", Name: "F1"},
        {ID: uuid.New(), Gender: "F", Name: "F2"},
    }

    order, err := GenerateBattingOrder(players, []uuid.UUID{})

    assert.NoError(t, err)

    // Count consecutive males
    consecutiveCount := 0
    maxConsecutive := 0
    lastGender := ""

    for _, pos := range order {
        player := findPlayer(players, pos.PlayerID)
        if player.Gender == "M" {
            if lastGender == "M" {
                consecutiveCount++
            } else {
                consecutiveCount = 1
            }
            if consecutiveCount > maxConsecutive {
                maxConsecutive = consecutiveCount
            }
        }
        lastGender = player.Gender
    }

    assert.LessOrEqual(t, maxConsecutive, 2, "Should have max 2 consecutive males")
}

func TestGenerateBattingOrder_PitcherSpacing(t *testing.T) {
    pitcher1 := uuid.New()
    pitcher2 := uuid.New()

    players := []models.Player{
        {ID: pitcher1, Gender: "M", Name: "Pitcher1"},
        {ID: uuid.New(), Gender: "F", Name: "F1"},
        {ID: uuid.New(), Gender: "M", Name: "M1"},
        {ID: uuid.New(), Gender: "F", Name: "F2"},
        {ID: pitcher2, Gender: "M", Name: "Pitcher2"},
        {ID: uuid.New(), Gender: "F", Name: "F3"},
        {ID: uuid.New(), Gender: "M", Name: "M2"},
        {ID: uuid.New(), Gender: "F", Name: "F4"},
        {ID: uuid.New(), Gender: "M", Name: "M3"},
        {ID: uuid.New(), Gender: "F", Name: "F5"},
    }

    order, err := GenerateBattingOrder(players, []uuid.UUID{pitcher1, pitcher2})

    assert.NoError(t, err)

    // Find positions of pitchers
    pos1 := -1
    pos2 := -1
    for i, pos := range order {
        if pos.PlayerID == pitcher1 {
            pos1 = i
        }
        if pos.PlayerID == pitcher2 {
            pos2 = i
        }
    }

    distance := abs(pos2 - pos1)
    minDistance := len(order) / 2 - 1

    assert.GreaterOrEqual(t, distance, minDistance, "Pitchers should be spaced apart")
}
```

---

### Task 7: Fielding Lineup Generation

**Goal**: Auto-assign 9 players to positions with 5-4 gender split

**Backend**:

```go
// internal/lineup/fielding.go
package lineup

func GenerateFieldingLineup(
    players []models.Player,
    inning int,
) ([]models.FieldingLineup, error) {
    confirmed := filterByAttendance(players, "going")

    if len(confirmed) < 9 {
        return nil, errors.New("insufficient players")
    }

    males := filterByGender(confirmed, "M")
    females := filterByGender(confirmed, "F")

    // Select 9 with 5-4 split
    var selected []models.Player
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

    // First pass: assign preferred positions
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, player := range selected {
            if assignedPlayers[player.ID] {
                continue
            }

            if contains(player.PreferredPositions, pos) {
                assignments = append(assignments, models.FieldingLineup{
                    PlayerID:    player.ID,
                    Position:    pos,
                    Inning:      inning,
                    IsGenerated: true,
                })
                assignedPlayers[player.ID] = true
                assignedPositions[pos] = true
                break
            }
        }
    }

    // Second pass: fill remaining
    for _, pos := range positions {
        if assignedPositions[pos] {
            continue
        }

        for _, player := range selected {
            if assignedPlayers[player.ID] {
                continue
            }

            assignments = append(assignments, models.FieldingLineup{
                PlayerID:    player.ID,
                Position:    pos,
                Inning:      inning,
                IsGenerated: true,
            })
            assignedPlayers[player.ID] = true
            assignedPositions[pos] = true
            break
        }
    }

    return assignments, nil
}

func selectN(players []models.Player, n int) []models.Player {
    if len(players) <= n {
        return players
    }
    return players[:n]
}

func contains(slice []string, item string) bool {
    for _, s := range slice {
        if s == item {
            return true
        }
    }
    return false
}
```

**Handler**:

```go
func GenerateFieldingLineupHandler(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")
    inning := r.URL.Query().Get("inning")

    if inning == "" {
        inning = "1"
    }

    inningNum, _ := strconv.Atoi(inning)

    // Get attendees
    var attendees []models.Player
    db.Joins("JOIN attendance ON attendance.player_id = players.id").
        Where("attendance.game_id = ? AND attendance.status = ?", gameID, "going").
        Find(&attendees)

    // Generate lineup
    lineup, err := lineup.GenerateFieldingLineup(attendees, inningNum)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // Save
    for i := range lineup {
        lineup[i].GameID = uuid.MustParse(gameID)
        db.Create(&lineup[i])
    }

    json.NewEncoder(w).Encode(lineup)
}
```

**Endpoints**:

```
POST /api/games/:id/fielding/generate?inning=1
GET  /api/games/:id/fielding
PUT  /api/games/:id/fielding/:lineup_id
DELETE /api/games/:id/fielding (clear all)
```

**Frontend**:

```tsx
// src/components/FieldingGrid.tsx
export const FieldingGrid = ({ gameId }) => {
  const { data: lineup } = useQuery(["fielding", gameId], () =>
    fetchFieldingLineup(gameId)
  );

  const innings = [1, 2, 3, 4, 5, 6, 7];
  const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"];

  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Position</th>
            {innings.map((i) => (
              <th key={i}>Inning {i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos}>
              <td>{pos}</td>
              {innings.map((inning) => {
                const assignment = lineup?.find(
                  (l) => l.position === pos && l.inning === inning
                );
                return (
                  <td key={inning}>
                    {assignment ? assignment.player.name : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// src/pages/admin/LineupEditor.tsx
export const LineupEditor = () => {
  const { id } = useParams();
  const generateBattingMutation = useMutation(() => generateBattingOrder(id));
  const generateFieldingMutation = useMutation((inning) =>
    generateFieldingLineup(id, inning)
  );

  return (
    <div>
      <h2>Batting Order</h2>
      <Button onClick={() => generateBattingMutation.mutate()}>
        Generate Batting Order
      </Button>
      <BattingOrderEditor gameId={id} />

      <h2>Fielding Lineup</h2>
      <Button onClick={() => generateFieldingMutation.mutate(1)}>
        Generate Inning 1
      </Button>
      <FieldingGrid gameId={id} />
    </div>
  );
};
```

---

### Task 8: Drag-and-Drop Lineup Editing

**Goal**: Admin can manually reorder and edit lineups

**Frontend with dnd-kit**:

```tsx
// Install: npm install @dnd-kit/core @dnd-kit/sortable

// src/components/BattingOrderEditor.tsx
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SortableItem = ({ id, player, position }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 bg-white border rounded mb-2 cursor-move"
    >
      <span className="font-bold">{position}.</span> {player.name} (
      {player.gender})
    </div>
  );
};

export const BattingOrderEditor = ({ gameId }) => {
  const { data: order, refetch } = useQuery(["battingOrder", gameId], () =>
    fetchBattingOrder(gameId)
  );
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (order) {
      setItems(order.sort((a, b) => a.battingPosition - b.battingPosition));
    }
  }, [order]);

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update positions
        newItems.forEach((item, index) => {
          item.battingPosition = index + 1;
        });

        // Save to backend
        updateBattingOrder(gameId, newItems);

        return newItems;
      });
    }
  };

  return (
    <div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              id={item.id}
              player={item.player}
              position={index + 1}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Validation warnings */}
      {!isValidAlternation(items) && (
        <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded">
          Warning: Batting order does not alternate M-F correctly
        </div>
      )}
    </div>
  );
};

const isValidAlternation = (order) => {
  let consecutiveCount = 0;
  let lastGender = "";

  for (const item of order) {
    if (item.player.gender === lastGender) {
      consecutiveCount++;
      if (consecutiveCount > 1) {
        return false; // More than 2 consecutive of same gender
      }
    } else {
      consecutiveCount = 0;
    }
    lastGender = item.player.gender;
  }

  return true;
};
```

**Backend Update Endpoint**:

```go
func UpdateBattingOrderHandler(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")

    var order []models.BattingOrder
    json.NewDecoder(r.Body).Decode(&order)

    // Validate
    if !validateBattingOrder(order) {
        http.Error(w, "Invalid batting order", http.StatusBadRequest)
        return
    }

    // Update in database
    tx := db.Begin()
    defer tx.Rollback()

    for _, item := range order {
        tx.Model(&models.BattingOrder{}).
            Where("id = ?", item.ID).
            Update("batting_position", item.BattingPosition)
    }

    tx.Commit()

    w.WriteHeader(http.StatusOK)
}
```

---

### Task 9: Score Tracking

**Goal**: Record final and inning-by-inning scores

**Backend**:

```go
// internal/handlers/score.go
func UpdateFinalScore(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")

    var req struct {
        FinalScore    int `json:"final_score"`
        OpponentScore int `json:"opponent_score"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    db.Model(&models.Game{}).
        Where("id = ?", gameID).
        Updates(map[string]interface{}{
            "final_score":    req.FinalScore,
            "opponent_score": req.OpponentScore,
            "status":         "completed",
        })

    w.WriteHeader(http.StatusOK)
}

func UpdateInningScore(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")
    inningNum, _ := strconv.Atoi(chi.URLParam(r, "inning"))

    var req struct {
        Score int `json:"score"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Upsert inning score
    var inningScore models.InningScore
    result := db.Where("game_id = ? AND inning = ?", gameID, inningNum).
        First(&inningScore)

    if result.Error != nil {
        // Create new
        inningScore = models.InningScore{
            GameID: uuid.MustParse(gameID),
            Inning: inningNum,
            Score:  req.Score,
        }
        db.Create(&inningScore)
    } else {
        // Update existing
        db.Model(&inningScore).Update("score", req.Score)
    }

    w.WriteHeader(http.StatusOK)
}

func GetGameScore(w http.ResponseWriter, r *http.Request) {
    gameID := chi.URLParam(r, "id")

    var game models.Game
    db.First(&game, "id = ?", gameID)

    var innings []models.InningScore
    db.Where("game_id = ?", gameID).Order("inning").Find(&innings)

    response := map[string]interface{}{
        "final_score":    game.FinalScore,
        "opponent_score": game.OpponentScore,
        "innings":        innings,
    }

    json.NewEncoder(w).Encode(response)
}
```

**Endpoints**:

```
PUT /api/games/:id/score
PUT /api/games/:id/innings/:inning/score
GET /api/games/:id/score
```

**Frontend**:

```tsx
// src/components/ScoreInput.tsx
export const ScoreInput = ({ gameId }) => {
  const { data: score, refetch } = useQuery(["score", gameId], () =>
    fetchScore(gameId)
  );
  const [innings, setInnings] = useState(Array(7).fill(0));

  useEffect(() => {
    if (score?.innings) {
      const newInnings = Array(7).fill(0);
      score.innings.forEach((i) => {
        newInnings[i.inning - 1] = i.score;
      });
      setInnings(newInnings);
    }
  }, [score]);

  const handleInningChange = (inning, value) => {
    const newInnings = [...innings];
    newInnings[inning - 1] = parseInt(value) || 0;
    setInnings(newInnings);

    // Auto-save
    updateInningScore(gameId, inning, parseInt(value) || 0).then(refetch);
  };

  const totalScore = innings.reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3>Inning Scores</h3>
      <div className="grid grid-cols-7 gap-2">
        {innings.map((score, index) => (
          <div key={index}>
            <label>Inning {index + 1}</label>
            <input
              type="number"
              value={score}
              onChange={(e) => handleInningChange(index + 1, e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3>Total Score: {totalScore}</h3>
        <label>Opponent Score</label>
        <input
          type="number"
          value={score?.opponent_score || 0}
          onChange={(e) =>
            updateFinalScore(gameId, totalScore, parseInt(e.target.value))
          }
          className="border p-2 rounded"
        />
      </div>
    </div>
  );
};

// src/components/ScoreCard.tsx
export const ScoreCard = ({ gameId }) => {
  const { data: score } = useQuery(["score", gameId], () => fetchScore(gameId));

  return (
    <div className="border rounded p-4">
      <h3 className="font-bold mb-2">Score</h3>
      <div className="grid grid-cols-8 gap-1 text-sm">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="text-center font-semibold">
            {i}
          </div>
        ))}
        <div className="text-center font-semibold">Total</div>

        {[1, 2, 3, 4, 5, 6, 7].map((i) => {
          const inning = score?.innings?.find((inn) => inn.inning === i);
          return (
            <div key={i} className="text-center border p-1">
              {inning?.score || 0}
            </div>
          );
        })}
        <div className="text-center border p-1 font-bold">
          {score?.final_score || 0}
        </div>
      </div>
      <div className="mt-2 text-sm">Opponent: {score?.opponent_score || 0}</div>
    </div>
  );
};
```

---

### Task 10: Player Preferences

**Goal**: Players select up to 3 preferred positions

**Backend**:

```go
// In models/player.go, use JSONB or separate table

// Option 1: JSONB column
type Player struct {
    ...
    PreferredPositions pq.StringArray `gorm:"type:text[]"`
}

// Option 2: Separate table
type PlayerPreference struct {
    ID       uuid.UUID
    PlayerID uuid.UUID
    Position string
}

// Handler
func UpdatePlayerPreferences(w http.ResponseWriter, r *http.Request) {
    playerID := chi.URLParam(r, "id")
    userID := r.Context().Value("userID").(string)

    // Verify user can only update their own preferences
    if playerID != userID {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }

    var req struct {
        Positions []string `json:"positions"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    if len(req.Positions) > 3 {
        http.Error(w, "Maximum 3 positions allowed", http.StatusBadRequest)
        return
    }

    db.Model(&models.Player{}).
        Where("id = ?", playerID).
        Update("preferred_positions", pq.StringArray(req.Positions))

    w.WriteHeader(http.StatusOK)
}
```

**Frontend**:

```tsx
// src/pages/player/Profile.tsx
export const Profile = () => {
  const { user } = useAuth();
  const { data: player } = useQuery(["player", user.id], () =>
    fetchPlayer(user.id)
  );
  const [selectedPositions, setSelectedPositions] = useState([]);

  const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"];

  useEffect(() => {
    if (player?.preferredPositions) {
      setSelectedPositions(player.preferredPositions);
    }
  }, [player]);

  const togglePosition = (pos) => {
    if (selectedPositions.includes(pos)) {
      setSelectedPositions(selectedPositions.filter((p) => p !== pos));
    } else if (selectedPositions.length < 3) {
      setSelectedPositions([...selectedPositions, pos]);
    }
  };

  const handleSave = () => {
    updatePlayerPreferences(user.id, selectedPositions);
  };

  return (
    <div>
      <h2>My Profile</h2>

      <div className="mb-4">
        <h3>Preferred Positions (select up to 3)</h3>
        <div className="grid grid-cols-3 gap-2">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => togglePosition(pos)}
              className={`p-2 border rounded ${
                selectedPositions.includes(pos)
                  ? "bg-blue-500 text-white"
                  : "bg-white"
              }`}
              disabled={
                !selectedPositions.includes(pos) &&
                selectedPositions.length >= 3
              }
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave}>Save Preferences</Button>
    </div>
  );
};
```

---

### Task 11: UI/UX Polish

**Goal**: Responsive design, loading states, error handling

**shadcn/ui Setup**:

```bash
cd frontend
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add form
```

**Loading States**:

```tsx
// src/components/LoadingSpinner.tsx
export const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// Use in components
export const GameList = () => {
  const { data: games, isLoading, error } = useQuery(["games"], fetchGames);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading games</div>;

  return (
    <div className="grid gap-4">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
};
```

**Error Handling with Toast**:

```tsx
// src/components/ToastProvider.tsx
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

// In mutations
const mutation = useMutation(updateAttendance, {
  onSuccess: () => {
    toast({
      title: "Success",
      description: "Attendance updated",
    });
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

**Responsive Navigation**:

```tsx
// src/components/Navigation.tsx
export const Navigation = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-blue-600 text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="font-bold text-xl">
            Softball Manager
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex space-x-4">
            <Link to="/games">Games</Link>
            {user?.isAdmin && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profile</Link>
            <button onClick={logout}>Logout</button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">{/* Menu items */}</div>
        )}
      </div>
    </nav>
  );
};
```

---

### Task 12: Production Deployment to DigitalOcean

**Goal**: Deploy application to DigitalOcean droplet

**Steps**:

1. **Create Droplet**:

   - Size: 2GB RAM, 1 vCPU ($12/month)
   - OS: Ubuntu 22.04 LTS
   - Enable monitoring and backups

2. **Initial Server Setup**:

```bash
ssh root@your_droplet_ip

# Create user
adduser softball
usermod -aG sudo softball
ufw allow OpenSSH
ufw enable

# Switch to user
su - softball

# Update system
sudo apt update && sudo apt upgrade -y
```

3. **Install Dependencies**:

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt install docker-compose -y

# Nginx
sudo apt install nginx -y

# Certbot
sudo apt install certbot python3-certbot-nginx -y
```

4. **Clone Repository**:

```bash
cd /home/softball
git clone https://github.com/yourusername/softball-manager.git
cd softball-manager
```

5. **Environment Setup**:

```bash
cat > .env << EOF
DATABASE_URL=postgresql://softball:password@db:5432/softball
JWT_SECRET=$(openssl rand -hex 32)
PORT=8080
FRONTEND_URL=https://yourdomain.com
ENV=production
EOF
```

6. **Build and Start**:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

7. **Configure Nginx**:

```nginx
# /etc/nginx/sites-available/softball-manager
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/softball-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL
sudo certbot --nginx -d yourdomain.com
```

8. **Automated Backups**:

```bash
# Create backup script
cat > /home/softball/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/softball/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec softball-manager_db_1 pg_dump -U softball softball > "$BACKUP_DIR/db_$DATE.sql"
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
EOF

chmod +x /home/softball/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/softball/backup.sh
```

9. **Monitoring**:

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps
```

---

## Prompts for AI Assistant

### Starting a new task:

```
I'm working on Task [N]: [Task Name]

Goal: [Brief description]

Please help me implement:
1. [Specific component/function]
2. [Specific endpoint/feature]

Business rules to follow:
- [Relevant rule]

Tech stack:
- Backend: Go with Chi, GORM
- Frontend: React with TypeScript, shadcn/ui

Please provide complete, production-ready code with error handling.
```

### Debugging issues:

```
I'm encountering [error/issue] when [action].

Context:
- Technology: [Go/React/PostgreSQL]
- Expected behavior: [description]
- Actual behavior: [description]
- Error message: [paste error]

Relevant code:
[paste code snippet]

Please help diagnose and fix this issue.
```

### Code review:

```
Please review this [algorithm/component] for:
1. Correctness against business rules
2. Performance optimization
3. Security considerations
4. Code quality and Go/React best practices

Code:
[paste code]
```

---

## Key Validation Rules

### Batting Order

- Must alternate M-F (one consecutive block allowed)
- If 2 pitchers, space at opposite ends
- Minimum 9 players with "going" status

### Fielding

- Exactly 9 players per inning
- 5-4 gender split (either 5M/4F or 5F/4M)
- All positions filled: C, 1B, 2B, 3B, SS, LF, CF, RF, Rover

### Attendance

- Players can only set their own
- Three states: going, not_going, maybe
- Admins can view all

### Permissions

- Admins: Full access to all features
- Players: View games, set attendance, edit own preferences

---

## Testing Checklist

### Backend Tests

- [ ] Batting order generation (equal genders)
- [ ] Batting order generation (unequal genders)
- [ ] Pitcher spacing algorithm
- [ ] Fielding lineup generation
- [ ] 5-4 gender split validation
- [ ] JWT authentication flow
- [ ] Authorization (admin vs player)
- [ ] CRUD operations

### Frontend Tests

- [ ] Login/logout flow
- [ ] Attendance update
- [ ] Lineup drag-and-drop
- [ ] Form validation
- [ ] Responsive design
- [ ] Error handling
- [ ] Loading states

### Integration Tests

- [ ] Complete user journey (player)
- [ ] Complete admin journey
- [ ] Lineup generation end-to-end
- [ ] Score tracking workflow

---

## Performance Optimization

### Backend

- Add database indexes on foreign keys
- Implement caching for frequently accessed data
- Use connection pooling for PostgreSQL
- Optimize N+1 queries with GORM preloading

### Frontend

- Code splitting with React.lazy()
- Memoize expensive computations
- Implement virtual scrolling for long lists
- Optimize images and assets

### Database

```sql
-- Add indexes
CREATE INDEX idx_attendance_game_id ON attendance(game_id);
CREATE INDEX idx_attendance_player_id ON attendance(player_id);
CREATE INDEX idx_batting_orders_game_id ON batting_orders(game_id);
CREATE INDEX idx_fielding_lineups_game_id ON fielding_lineups(game_id);
CREATE INDEX idx_games_date ON games(date);
```

---

## Future Enhancements

### Phase 2 Features

- [ ] Email notifications for new games
- [ ] SMS reminders before games
- [ ] Player statistics tracking
- [ ] Season standings
- [ ] Photo uploads for games
- [ ] Chat/messaging system
- [ ] Mobile app (React Native)
- [ ] Integration with league website
- [ ] Advanced analytics dashboard
- [ ] Automatic lineup rotation
- [ ] Weather integration
- [ ] Carpool coordination

---

This comprehensive product plan provides a complete roadmap for building the softball team manager application. Start with Task 1 and work through systematically, using the provided code examples and implementation details as a guide.
