package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/auth"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func AuthMiddleware(next http.Handler) http.Handler {
	// First wrap with Auth0's JWT validation middleware
	jwtHandler := auth.CheckJWT().CheckJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If we get here, the token is valid. Extract the Auth0 Subject (sub)
		sub, err := auth.GetAuth0Sub(r.Context())
		if err != nil {
			http.Error(w, "Could not extract user from token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "auth0Sub", sub)

		// Look up local user by auth0_id to inject userID into context for existing handlers
		var user models.User
		if result := database.DB.Where("auth0_id = ?", sub).First(&user); result.Error == nil {
			ctx = context.WithValue(ctx, "userID", user.ID)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	}))

	return jwtHandler
}

func RequireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value("userID").(uuid.UUID)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var user models.User
		if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		}

		if !user.IsSuperAdmin {
			http.Error(w, "Forbidden: Super admin access required", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
