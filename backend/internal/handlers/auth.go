package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"gorm.io/gorm"
)

type SyncRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type AuthResponse struct {
	User models.User `json:"user"`
}

func SyncUser(w http.ResponseWriter, r *http.Request) {
	auth0Sub, ok := r.Context().Value("auth0Sub").(string)
	if !ok || auth0Sub == "" {
		http.Error(w, "Unauthorized: missing Auth0 subject", http.StatusUnauthorized)
		return
	}

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, "Email is required for syncing", http.StatusBadRequest)
		return
	}

	var user models.User
	
	// Transaction to safely check and create/update user and handle invites
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// First check if user exists by Auth0 ID
		result := tx.Where("auth0_id = ?", auth0Sub).First(&user)
		
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				// User not found by auth0_id. Let's gracefully support matching by email just in case 
				// (e.g., manual DB sync or legacy users testing the new login)
				if err := tx.Where("email = ?", req.Email).First(&user).Error; err == nil {
					// User exists by email, update their Auth0 ID
					user.Auth0ID = auth0Sub
					user.Name = req.Name // Update name from Auth0
					if err := tx.Save(&user).Error; err != nil {
						return err
					}
				} else {
					// User doesn't exist by auth0_id OR email. Create a new one.
					user = models.User{
						Auth0ID: auth0Sub,
						Name:    req.Name,
						Email:   req.Email,
					}
					if err := tx.Create(&user).Error; err != nil {
						return err
					}

					// Process pending invitations for the new user email
					var invitations []models.Invitation
					if err := tx.Where("email = ? AND (expires_at > ? OR expires_at IS NULL) AND accepted_at IS NULL", user.Email, time.Now()).Find(&invitations).Error; err == nil {
						for _, inv := range invitations {
							member := models.TeamMember{
								TeamID:   inv.TeamID,
								UserID:   user.ID,
								Role:     inv.Role,
								IsActive: true,
								JoinedAt: time.Now(),
							}
							// Default admin permissions mapping if Role == admin
							if inv.Role == "admin" || inv.Role == "admin,pitcher" {
								member.IsAdmin = true
							}
							
							if err := tx.Create(&member).Error; err != nil {
								return err
							}
							
							now := time.Now()
							inv.AcceptedAt = &now
							if err := tx.Save(&inv).Error; err != nil {
								return err
							}
						}
					}
				}
			} else {
				return result.Error // Some other DB error
			}
		} else {
			// User found, maybe update their name if changed in Auth0
			if user.Name != req.Name && req.Name != "" {
				user.Name = req.Name
				tx.Save(&user)
			}
		}
		
		return nil
	})

	if err != nil {
		http.Error(w, "Failed to sync user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		User: user,
	})
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		// Middleware injects auth0Sub, but if userID is missing, local user isn't synced yet
		http.Error(w, "Unauthorized or not synced locally", http.StatusUnauthorized)
		return
	}

	var user models.User
	if result := database.DB.First(&user, userID); result.Error != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(user)
}
