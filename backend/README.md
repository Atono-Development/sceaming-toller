# Screaming Toller Backend

Backend API for the Screaming Toller softball team management application.

## Tech Stack

- **Language**: Go 1.23
- **Framework**: Chi router
- **Database**: PostgreSQL with GORM
- **Email**: Resend
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Docker and Docker Compose (or OrbStack)
- Resend account for email functionality (optional for development)

### Environment Setup

1. **Copy the example environment file**:

   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables** in `.env`:

   **Required for email functionality**:

   - `RESEND_API_KEY`: Your Resend API key (get one at https://resend.com)
   - `FROM_EMAIL`: Verified sender email address in Resend
   - `APP_URL`: Frontend URL (default: `http://localhost:5173`)

   **Required for production**:

   - `JWT_SECRET`: Secure random string for JWT signing

   **Optional** (defaults are set in docker-compose.yml):

   - `DB_URL`: PostgreSQL connection string

### Running Locally

1. **Start all services**:

   ```bash
   docker compose up
   ```

   The backend will be available at `http://localhost:8080`

2. **Run in detached mode**:

   ```bash
   docker compose up -d
   ```

3. **View logs**:

   ```bash
   docker compose logs -f backend
   ```

4. **Stop services**:
   ```bash
   docker compose down
   ```

### Setting Up Email (Resend)

Email invitations are sent when team members are invited. To enable this feature:

1. **Sign up for Resend**:

   - Go to https://resend.com
   - Create a free account (100 emails/day, 3,000/month)

2. **Generate an API key**:

   - Navigate to API Keys in your Resend dashboard
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Verify your domain** (for production):

   - Add your domain in Resend dashboard
   - Add DNS records as instructed
   - For development, you can use Resend's test domain

4. **Update `.env` file**:

   ```env
   RESEND_API_KEY=re_your_actual_api_key
   FROM_EMAIL=noreply@yourdomain.com
   ```

5. **Restart the backend**:
   ```bash
   docker compose restart backend
   ```

### Testing Email Locally

1. Ensure your `.env` file has valid Resend credentials
2. Create a team and invite a member
3. Check the email inbox for the invitation
4. Check backend logs for any email errors:
   ```bash
   docker compose logs backend | grep -i email
   ```

**Note**: If email sending fails, the invitation is still created successfully. Users can manually share the invitation URL.

## API Documentation

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Teams

- `POST /api/teams` - Create team
- `GET /api/teams` - List user's teams
- `GET /api/teams/:id` - Get team details

### Invitations

- `POST /api/teams/:teamID/invitations` - Invite member (sends email)
- `GET /api/invitations/:token` - Get invitation details
- `POST /api/invitations/:token/accept` - Accept invitation

### Games

- `POST /api/teams/:teamID/games` - Create game
- `GET /api/teams/:teamID/games` - List games
- `PUT /api/games/:id/scores` - Update game scores

## Development

### Running Go Commands

Since the app runs in Docker, use `docker compose exec` to run Go commands:

```bash
# Add a dependency
docker compose exec backend go get package-name

# Run tests
docker compose exec backend go test ./...

# Format code
docker compose exec backend go fmt ./...

# Build
docker compose exec backend go build .
```

### Database Migrations

The application uses GORM's AutoMigrate feature. Models are automatically migrated on startup.

To manually run migrations or access the database:

```bash
# Access PostgreSQL
docker compose exec db psql -U user -d screaming_toller

# View tables
\dt

# Exit
\q
```

## Troubleshooting

### Email not sending

1. **Check environment variables**:

   ```bash
   docker compose exec backend env | grep RESEND
   ```

2. **Verify API key is valid**:

   - Log into Resend dashboard
   - Check API key status
   - Ensure it hasn't been revoked

3. **Check logs**:

   ```bash
   docker compose logs backend | grep -i "email\|resend"
   ```

4. **Common issues**:
   - Invalid API key format (should start with `re_`)
   - FROM_EMAIL not verified in Resend
   - Rate limits exceeded (100/day on free tier)

### Database connection issues

1. **Ensure database is running**:

   ```bash
   docker compose ps db
   ```

2. **Check connection string**:

   - Default: `postgres://user:password@db:5432/screaming_toller?sslmode=disable`

3. **Reset database**:
   ```bash
   docker compose down -v
   docker compose up
   ```

## Project Structure

```
backend/
├── cmd/                    # Command-line tools (if any)
├── internal/
│   ├── algorithms/        # Lineup generation algorithms
│   ├── auth/             # Authentication utilities
│   ├── database/         # Database connection
│   ├── handlers/         # HTTP request handlers
│   ├── middleware/       # HTTP middleware
│   ├── models/           # Database models
│   └── services/         # Business logic services
│       └── email.go      # Email service (Resend)
├── .env.example          # Example environment variables
├── Dockerfile            # Docker configuration
├── go.mod               # Go dependencies
├── go.sum               # Go dependency checksums
└── main.go              # Application entry point
```

## Contributing

1. Make changes to the code
2. Test locally with Docker
3. Ensure code builds: `docker compose exec backend go build .`
4. Format code: `docker compose exec backend go fmt ./...`
5. Commit and push changes

## License

[Add your license here]
