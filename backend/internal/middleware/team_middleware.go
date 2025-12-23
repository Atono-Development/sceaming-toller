package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func RequireTeamMembership(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		teamIDStr := chi.URLParam(r, "teamID")
		if teamIDStr == "" {
			http.Error(w, "Team ID required", http.StatusBadRequest)
			return
		}

		teamID, err := uuid.Parse(teamIDStr)
		if err != nil {
			http.Error(w, "Invalid team ID", http.StatusBadRequest)
			return
		}

		userID, ok := r.Context().Value("userID").(uuid.UUID)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var membership models.TeamMember
		result := database.DB.Where("team_id = ? AND user_id = ? AND is_active = ?",
			teamID, userID, true).First(&membership)

		if result.Error != nil {
			http.Error(w, "Not a member of this team", http.StatusForbidden)
			return
		}

		// Add membership and teamID to context
		ctx := context.WithValue(r.Context(), "teamMembership", membership)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireTeamAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		membership, ok := r.Context().Value("teamMembership").(models.TeamMember)

		if !ok || membership.Role != "admin" {
			http.Error(w, "Requires admin role", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
