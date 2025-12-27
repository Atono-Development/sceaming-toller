package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func GetTeamMembers(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var members []models.TeamMember
	// Use Preload to get User details (Name, Email) and Preferences
	if result := database.DB.Preload("User").Preload("Preferences").Where("team_id = ? AND is_active = ?", teamID, true).Find(&members); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(members)
}

func RemoveMember(w http.ResponseWriter, r *http.Request) {
	// teamIDStr := chi.URLParam(r, "teamID") // Verified by middleware
	memberIDStr := chi.URLParam(r, "memberID")
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		http.Error(w, "Invalid member ID", http.StatusBadRequest)
		return
	}

	// Soft delete: set IsActive to false
	if result := database.DB.Model(&models.TeamMember{}).Where("id = ?", memberID).Update("is_active", false); result.Error != nil {
		http.Error(w, "Failed to remove member", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "removed"})
}

func GetMyPreferences(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("userID").(uuid.UUID)

	// Find the team member for this user and team
	var teamMember models.TeamMember
	if result := database.DB.Where("team_id = ? AND user_id = ? AND is_active = ?", teamID, userID, true).First(&teamMember); result.Error != nil {
		http.Error(w, "Team member not found", http.StatusNotFound)
		return
	}

	// Get preferences
	var preferences []models.TeamMemberPreference
	if result := database.DB.Where("team_member_id = ?", teamMember.ID).Order("preference_rank").Find(&preferences); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(preferences)
}

type UpdatePreferencesRequest struct {
	Preferences []struct {
		Position       string `json:"position"`
		PreferenceRank int    `json:"preferenceRank"`
	} `json:"preferences"`
}

func UpdateMyPreferences(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("userID").(uuid.UUID)

	// Find the team member for this user and team
	var teamMember models.TeamMember
	if result := database.DB.Where("team_id = ? AND user_id = ? AND is_active = ?", teamID, userID, true).First(&teamMember); result.Error != nil {
		http.Error(w, "Team member not found", http.StatusNotFound)
		return
	}

	var req UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate preferences (max 3, unique ranks 1-3)
	if len(req.Preferences) > 3 {
		http.Error(w, "Maximum 3 preferences allowed", http.StatusBadRequest)
		return
	}

	// Validate ranks are unique and within 1-3
	rankSet := make(map[int]bool)
	for _, pref := range req.Preferences {
		if pref.PreferenceRank < 1 || pref.PreferenceRank > 3 {
			http.Error(w, "Preference rank must be between 1 and 3", http.StatusBadRequest)
			return
		}
		if rankSet[pref.PreferenceRank] {
			http.Error(w, "Preference ranks must be unique", http.StatusBadRequest)
			return
		}
		rankSet[pref.PreferenceRank] = true
	}

	// Delete existing preferences
	if result := database.DB.Where("team_member_id = ?", teamMember.ID).Delete(&models.TeamMemberPreference{}); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Create new preferences
	for _, pref := range req.Preferences {
		newPref := models.TeamMemberPreference{
			TeamMemberID:   teamMember.ID,
			Position:       pref.Position,
			PreferenceRank: pref.PreferenceRank,
		}
		if result := database.DB.Create(&newPref); result.Error != nil {
			http.Error(w, result.Error.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func GetAllTeamMemberPreferences(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	// Get all team members with their preferences
	var members []models.TeamMember
	if result := database.DB.Preload("User").Preload("Preferences").Where("team_id = ? AND is_active = ?", teamID, true).Find(&members); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Format response with member info and their preferences
	type MemberWithPreferences struct {
		ID           uuid.UUID                   `json:"id"`
		Name         string                      `json:"name"`
		Email        string                      `json:"email"`
		Role         string                      `json:"role"`
		Gender       string                      `json:"gender"`
		Preferences []models.TeamMemberPreference `json:"preferences"`
	}

	var response []MemberWithPreferences
	for _, member := range members {
		response = append(response, MemberWithPreferences{
			ID:           member.ID,
			Name:         member.User.Name,
			Email:        member.User.Email,
			Role:         member.Role,
			Gender:       member.Gender,
			Preferences:  member.Preferences,
		})
	}

	json.NewEncoder(w).Encode(response)
}

func GetMyTeamMemberInfo(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("userID").(uuid.UUID)

	// Find the team member for this user and team
	var teamMember models.TeamMember
	if result := database.DB.Preload("User").Where("team_id = ? AND user_id = ? AND is_active = ?", teamID, userID, true).First(&teamMember); result.Error != nil {
		http.Error(w, "Team member not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(teamMember)
}

func UpdateMyPitcherStatus(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("userID").(uuid.UUID)

	// Find the team member for this user and team
	var teamMember models.TeamMember
	if result := database.DB.Where("team_id = ? AND user_id = ? AND is_active = ?", teamID, userID, true).First(&teamMember); result.Error != nil {
		http.Error(w, "Team member not found", http.StatusNotFound)
		return
	}

	var req struct {
		IsPitcher bool `json:"isPitcher"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update the role to include or remove pitcher
	if req.IsPitcher {
		if !strings.Contains(strings.ToLower(teamMember.Role), "pitcher") {
			if teamMember.Role == "" {
				teamMember.Role = "pitcher"
			} else {
				teamMember.Role = teamMember.Role + ",pitcher"
			}
		}
	} else {
		// Remove pitcher from role
		roles := strings.Split(teamMember.Role, ",")
		var newRoles []string
		for _, role := range roles {
			if strings.TrimSpace(strings.ToLower(role)) != "pitcher" {
				newRoles = append(newRoles, strings.TrimSpace(role))
			}
		}
		teamMember.Role = strings.Join(newRoles, ",")
	}

	if result := database.DB.Save(&teamMember); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}
