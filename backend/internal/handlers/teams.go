package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func CreateTeam(w http.ResponseWriter, r *http.Request) {
	var team models.Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if result := database.DB.Create(&team); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(team)
}

func GetTeams(w http.ResponseWriter, r *http.Request) {
	var teams []models.Team
	if result := database.DB.Find(&teams); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(teams)
}

func GetTeam(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "id")
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
