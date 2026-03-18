package main

import (
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/handlers"
	"github.com/liam/screaming-toller/backend/internal/middleware"
	"golang.org/x/time/rate"
)

func main() {
	// Initialize Structured Logging
	var handler slog.Handler
	if os.Getenv("ENV") == "production" {
		handler = slog.NewJSONHandler(os.Stdout, nil)
	} else {
		handler = slog.NewTextHandler(os.Stdout, nil)
	}
	slog.SetDefault(slog.New(handler))

	// Initialize Database
	database.InitDB()

	r := chi.NewRouter()

	// Middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// CORS
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173"
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   strings.Split(allowedOrigins, ","),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Auth Rate Limiter (10 requests per minute, burst of 20)
	authLimiter := middleware.NewIPRateLimiter(rate.Every(time.Minute/10), 20)

	// Public Routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.RateLimitMiddleware(authLimiter))
		r.Post("/api/auth/register", handlers.Register)
		r.Post("/api/auth/login", handlers.Login)
	})

	// Protected Routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)
		r.Get("/api/auth/me", handlers.GetMe)
		r.Post("/api/teams", handlers.CreateTeam)
		r.Get("/api/teams", handlers.GetTeams)

		// Admin Routes (Global)
		r.Route("/api/admin", func(r chi.Router) {
			r.Get("/teams/pending", handlers.GetPendingTeams)
			r.Post("/teams/{teamID}/approve", handlers.ApproveTeam)
			r.Post("/teams/{teamID}/reject", handlers.RejectTeam)
		})

		// Invitations
		r.Get("/api/invitations/{token}", handlers.GetInvitation)
		r.Post("/api/invitations/{token}/accept", handlers.AcceptInvitation)

		// Team-scoped routes
		r.Route("/api/teams/{teamID}", func(r chi.Router) {
			r.Use(middleware.RequireTeamMembership)
			r.Get("/", handlers.GetTeam)
			r.Get("/games", handlers.GetTeamGames)
			r.Get("/games/{gameID}", handlers.GetGame)
			r.Get("/members", handlers.GetTeamMembers)

			// Player preference routes
			r.Get("/members/me/preferences", handlers.GetMyPreferences)
			r.Put("/members/me/preferences", handlers.UpdateMyPreferences)
			r.Get("/members/me", handlers.GetMyTeamMemberInfo)
			r.Put("/members/me/pitcher", handlers.UpdateMyPitcherStatus)
			r.Put("/members/me/gender", handlers.UpdateMyGender)

			// Game-specific routes
			r.Get("/games/{gameID}/attendance", handlers.GetAttendance)
			r.Put("/games/{gameID}/attendance", handlers.UpdateAttendance)
			r.Get("/games/{gameID}/batting-order", handlers.GetBattingOrder)
			r.Get("/games/{gameID}/fielding", handlers.GetFieldingLineup)

			// Admin-only routes
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeamAdmin)
				r.Post("/games", handlers.CreateGame)
				r.Put("/games/{gameID}", handlers.UpdateGame)
				r.Delete("/games/{gameID}", handlers.DeleteGame)
				r.Put("/games/{gameID}/score", handlers.UpdateGameScore)
				r.Put("/games/{gameID}/innings", handlers.UpdateInningScores)
				r.Put("/games/{gameID}/attendance/admin", handlers.AdminUpdateAttendance)
				r.Post("/games/{gameID}/attendance/initialize", handlers.InitializeGameAttendance)
				
				// Lineup management routes
				r.Post("/games/{gameID}/batting-order/generate", handlers.GenerateBattingOrder)
				r.Put("/games/{gameID}/batting-order", handlers.UpdateBattingOrder)
				r.Delete("/games/{gameID}/batting-order", handlers.DeleteBattingOrder)
				
				r.Post("/games/{gameID}/fielding/generate", handlers.GenerateFieldingLineup)
				r.Post("/games/{gameID}/fielding/generate-complete", handlers.GenerateCompleteFieldingLineup)
				r.Put("/games/{gameID}/fielding", handlers.UpdateFieldingLineup)
				r.Delete("/games/{gameID}/fielding", handlers.DeleteFieldingLineup)
				
				r.Post("/invitations", handlers.InviteMember)
				r.Delete("/members/{memberID}", handlers.RemoveMember)
				r.Get("/members/preferences", handlers.GetAllTeamMemberPreferences)
				r.Put("/members/{memberID}/preferences", handlers.UpdateMemberPreferences)
				r.Put("/members/{memberID}/pitcher", handlers.UpdateMemberPitcherStatus)
			})
		})
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok"}`))
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Screaming Toller API"))
	})

	log.Println("Server starting on :8080...")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
