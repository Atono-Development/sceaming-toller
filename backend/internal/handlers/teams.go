package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"github.com/liam/screaming-toller/backend/internal/services"
	"gorm.io/gorm"
)

// ... existing CreateTeam, GetTeams, GetTeam ...

func GetPendingTeams(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil || !user.IsSuperAdmin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var teams []models.Team
	if err := database.DB.Where("status = ?", "pending").Find(&teams).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(teams)
}

func ApproveTeam(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var admin models.User
	if err := database.DB.First(&admin, adminID).Error; err != nil || !admin.IsSuperAdmin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var team models.Team
	if err := database.DB.First(&team, teamID).Error; err != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	team.Status = "active"
	if err := database.DB.Save(&team).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Send email to team creator
	var creator models.TeamMember
	if err := database.DB.Preload("User").Where("team_id = ? AND is_admin = ?", team.ID, true).First(&creator).Error; err == nil {
		emailService, _ := services.NewEmailService()
		if emailService != nil {
			emailService.SendTeamApprovedEmail(creator.User.Email, team.Name)
		}
	}

	json.NewEncoder(w).Encode(team)
}

func RejectTeam(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var admin models.User
	if err := database.DB.First(&admin, adminID).Error; err != nil || !admin.IsSuperAdmin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var team models.Team
	if err := database.DB.First(&team, teamID).Error; err != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	// Send email to team creator before deletion
	var creator models.TeamMember
	if err := database.DB.Preload("User").Where("team_id = ? AND is_admin = ?", team.ID, true).First(&creator).Error; err == nil {
		emailService, _ := services.NewEmailService()
		if emailService != nil {
			emailService.SendTeamRejectedEmail(creator.User.Email, team.Name)
		}
	}

	// Delete the team and its associations in a transaction to ensure data integrity
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Get all team member IDs to delete their preferences
		var memberIDs []uuid.UUID
		if err := tx.Model(&models.TeamMember{}).Where("team_id = ?", team.ID).Pluck("id", &memberIDs).Error; err != nil {
			return err
		}

		// 2. Delete TeamMemberPreferences
		if len(memberIDs) > 0 {
			if err := tx.Unscoped().Where("team_member_id IN ?", memberIDs).Delete(&models.TeamMemberPreference{}).Error; err != nil {
				return err
			}
		}

		// 3. Delete TeamMembers
		if err := tx.Unscoped().Where("team_id = ?", team.ID).Delete(&models.TeamMember{}).Error; err != nil {
			return err
		}

		// 4. Delete Invitations (if any)
		if err := tx.Unscoped().Where("team_id = ?", team.ID).Delete(&models.Invitation{}).Error; err != nil {
			return err
		}

		// 5. Delete the Team itself
		if err := tx.Unscoped().Delete(&team).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
    
    // Return empty success or the deleted info
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Team rejected and deleted"})
}

func CreateTeam(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var team models.Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Set default status to pending for new teams
	team.Status = "pending"

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&team).Error; err != nil {
			return err
		}

		membership := models.TeamMember{
			TeamID:   team.ID,
			UserID:   userID,
			Role:     "admin",
			IsAdmin:  true,
			IsActive: true,
		}
		if err := tx.Create(&membership).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Send email to Super Admin(s)
	emailService, err := services.NewEmailService()
	if err == nil {
		var user models.User
		database.DB.First(&user, userID)
		
		var superAdmins []models.User
		database.DB.Where("is_super_admin = ?", true).Find(&superAdmins)
		
		for _, admin := range superAdmins {
			emailService.SendTeamRequestEmail(admin.Email, user.Name, team.Name)
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

func GetTeams(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(uuid.UUID)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var memberships []models.TeamMember
	err := database.DB.Preload("Team").
		Where("user_id = ? AND is_active = ?", userID, true).
		Find(&memberships).Error

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	teams := make([]models.Team, 0, len(memberships))
	for _, m := range memberships {
		team := m.Team
		// shallow copy membership to avoid circular ref if necessary, or just assign
		memberInfo := m
		memberInfo.Team = models.Team{} // clear self-ref to stay clean
		team.Membership = &memberInfo
		teams = append(teams, team)
	}

	json.NewEncoder(w).Encode(teams)
}

func GetTeam(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var team models.Team
	if result := database.DB.First(&team, teamID); result.Error != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(team)
}

func UploadTeamLogo(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	// Limit to 5MB
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)
	if err := r.ParseMultipartForm(5 * 1024 * 1024); err != nil {
		http.Error(w, "File too large (max 5MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("logo")
	if err != nil {
		http.Error(w, "Failed to get file from form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".svg": true}
	if !allowedExts[ext] {
		http.Error(w, "Invalid file type. Only PNG, JPEG, and SVG are allowed.", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	uploadDir := "./uploads/logos"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	fileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	filePath := filepath.Join(uploadDir, fileName)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file content", http.StatusInternalServerError)
		return
	}

	// Update team in DB
	var team models.Team
	if err := database.DB.First(&team, teamID).Error; err != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	// Delete old logo if it exists
	if team.LogoURL != "" {
		// handle both /api/uploads/ and /uploads/ prefixes
		relPath := team.LogoURL
		relPath = strings.TrimPrefix(relPath, "/api")
		
		oldFilePath := filepath.Join(".", relPath)
		os.Remove(oldFilePath)
	}

	team.LogoURL = "/api/uploads/logos/" + fileName
	if err := database.DB.Save(&team).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(team)
}

func DeleteTeamLogo(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var team models.Team
	if err := database.DB.First(&team, teamID).Error; err != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	if team.LogoURL != "" {
		relPath := strings.TrimPrefix(team.LogoURL, "/api")
		filePath := filepath.Join(".", relPath)
		os.Remove(filePath)
	}

	team.LogoURL = ""
	if err := database.DB.Save(&team).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(team)
}
