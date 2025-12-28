package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/handlers"
	"github.com/liam/screaming-toller/backend/internal/middleware"
)

func main() {
	// Initialize Database
	database.InitDB()

	r := chi.NewRouter()

	// Middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public Routes
	r.Post("/api/auth/register", handlers.Register)
	r.Post("/api/auth/login", handlers.Login)

	// Protected Routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)
		r.Get("/api/auth/me", handlers.GetMe)
		r.Post("/api/teams", handlers.CreateTeam)
		r.Get("/api/teams", handlers.GetTeams)

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
				
				// Lineup management routes
				r.Post("/games/{gameID}/batting-order/generate", handlers.GenerateBattingOrder)
				r.Put("/games/{gameID}/batting-order", handlers.UpdateBattingOrder)
				r.Delete("/games/{gameID}/batting-order", handlers.DeleteBattingOrder)
				
				r.Post("/games/{gameID}/fielding/generate", handlers.GenerateFieldingLineup)
				r.Put("/games/{gameID}/fielding", handlers.UpdateFieldingLineup)
				r.Delete("/games/{gameID}/fielding", handlers.DeleteFieldingLineup)
				
				r.Post("/invitations", handlers.InviteMember)
				r.Delete("/members/{memberID}", handlers.RemoveMember)
				r.Get("/members/preferences", handlers.GetAllTeamMemberPreferences)
			})
		})
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Screaming Toller API"))
	})

	log.Println("Server starting on :8080...")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
