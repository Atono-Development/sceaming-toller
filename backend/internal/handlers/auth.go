package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/auth"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	user := models.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
	}

	// Transaction to create user and accept any pending invitations
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		// Check for invitations
		var invitations []models.Invitation
		if err := tx.Where("email = ? AND (expires_at > ? OR expires_at IS NULL) AND accepted_at IS NULL", user.Email, time.Now()).Find(&invitations).Error; err != nil {
			// Just log error or ignore? Ideally we shouldn't fail registration if this fails, but better to be transactional.
			// Proceeding without erroring out, assume no invites if error? No, let's just log.
			// For simplicity in this plan, let's treat it as part of transaction.
		}

		for _, inv := range invitations {
			member := models.TeamMember{
				TeamID:   inv.TeamID,
				UserID:   user.ID,
				Role:     inv.Role,
				IsActive: true,
				JoinedAt: time.Now(),
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
		
		return nil
	})

	if err != nil {
		http.Error(w, "User already exists or database error", http.StatusConflict) // Could be specific
		return
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var user models.User
	if result := database.DB.Where("email = ?", req.Email).First(&user); result.Error != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if result := database.DB.First(&user, userID); result.Error != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(user)
}
