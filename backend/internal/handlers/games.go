package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

type CreateGameRequest struct {
	Date         string `json:"date"` // YYYY-MM-DD
	Time         string `json:"time"` // HH:MM
	Location     string `json:"location"`
	OpposingTeam string `json:"opposingTeam"`
}

func CreateGame(w http.ResponseWriter, r *http.Request) {
	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var req CreateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "Invalid date format. Use YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	game := models.Game{
		TeamID:       teamID,
		Date:         date,
		Time:         req.Time,
		Location:     req.Location,
		OpposingTeam: req.OpposingTeam,
		Status:       "scheduled",
	}

	if result := database.DB.Create(&game); result.Error != nil {
		http.Error(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(game)
}

func GetTeamGames(w http.ResponseWriter, r *http.Request) {
	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var games []models.Game
	if result := database.DB.Where("team_id = ?", teamID).Order("date asc").Find(&games); result.Error != nil {
		http.Error(w, "Failed to fetch games", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(games)
}

func GetGame(w http.ResponseWriter, r *http.Request) {
	// Verify game belongs to team (if strictly needed, or just get by ID)
	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}
	gameID, err := uuid.Parse(chi.URLParam(r, "gameID"))
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(game)
}
