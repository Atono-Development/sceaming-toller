package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"gorm.io/gorm"
)

type InviteMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"` // "admin" or "player"
}

func InviteMember(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("userID").(uuid.UUID)

	var req InviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Basic validation
	if req.Email == "" {
		http.Error(w, "Email is required", http.StatusBadRequest)
		return
	}
	if req.Role != "admin" && req.Role != "player" {
		req.Role = "player" // Default to player
	}

	// Generate a unique token
	token := uuid.New().String()

	invitation := models.Invitation{
		TeamID:    teamID,
		Email:     req.Email,
		Token:     token,
		Role:      req.Role,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // Expires in 7 days
		CreatedBy: userID,
	}

	if result := database.DB.Create(&invitation); result.Error != nil {
		http.Error(w, "Failed to create invitation", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invitation)
}

func GetInvitation(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	var invitation models.Invitation
	if result := database.DB.Preload("Team").Where("token = ?", token).First(&invitation); result.Error != nil {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}

	if time.Now().After(invitation.ExpiresAt) {
		http.Error(w, "Invitation expired", http.StatusGone)
		return
	}
	
	if invitation.AcceptedAt != nil {
		http.Error(w, "Invitation already accepted", http.StatusConflict)
		return
	}

	json.NewEncoder(w).Encode(invitation)
}

func AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var invitation models.Invitation
	if result := database.DB.Where("token = ?", token).First(&invitation); result.Error != nil {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}

	if time.Now().After(invitation.ExpiresAt) {
		http.Error(w, "Invitation expired", http.StatusGone)
		return
	}

	if invitation.AcceptedAt != nil {
		http.Error(w, "Invitation already accepted", http.StatusConflict)
		return
	}

	// Transaction to create membership and mark invitation as accepted
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Check if already a member
		var existingMember models.TeamMember
		if err := tx.Where("team_id = ? AND user_id = ?", invitation.TeamID, userID).First(&existingMember).Error; err == nil {
			// Already a member
			if existingMember.IsActive {
				return nil // Already visible
			}
			// Reactivate
			existingMember.IsActive = true
			if invitation.Role == "admin" {
				existingMember.IsAdmin = true
				// Don't overwrite existing role string if it has other roles, 
				// but since they were inactive, maybe we should just reset?
				// Let's assume we keep "player" as base if it was "admin".
				// But wait, the invitation role is singular. 
				// If invite was admin, we set IsAdmin=true.
				// We don't need to put "admin" in role string anymore.
			} else {
				// If invite is player, do we unset admin? Probably not safely. 
				// But usually invite matches intent.
				// Let's just update based on invite.
				// If invite is "player", we don't set IsAdmin (default false or keep existing?)
				// Let's stick to: Invite grants permissions.
			}
			// For simplicity and matching logic:
			// If invite is admin -> IsAdmin = true.
			// If invite is player -> IsAdmin = false (or keep existing? Safer to just set what was invited)
			// Actually, if I invite someone as Admin, they should become Admin. 
			// If I invite as Player, they should be Player.
			
			existingMember.IsAdmin = invitation.Role == "admin"
			if invitation.Role == "admin" {
				existingMember.Role = "player" // Default role string
			} else {
				existingMember.Role = invitation.Role
			}
			
			return tx.Save(&existingMember).Error
		}

		// Create new member
		newMember := models.TeamMember{
			TeamID:   invitation.TeamID,
			UserID:   userID,
			Role:     invitation.Role, // Will be "admin" or "player"
			IsAdmin:  invitation.Role == "admin",
			IsActive: true,
			JoinedAt: time.Now(),
		}
		
		if newMember.IsAdmin {
			newMember.Role = "player" // Normalize role string to not contain "admin"
		}
		if err := tx.Create(&newMember).Error; err != nil {
			return err
		}

		// Mark invitation accepted
		now := time.Now()
		invitation.AcceptedAt = &now
		return tx.Save(&invitation).Error
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
}
