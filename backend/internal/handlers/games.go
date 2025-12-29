package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"github.com/liam/screaming-toller/backend/internal/algorithms"
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

func GetAttendance(w http.ResponseWriter, r *http.Request) {
	gameID, err := uuid.Parse(chi.URLParam(r, "gameID"))
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	var attendance []models.Attendance
	if result := database.DB.Preload("TeamMember.User").Where("game_id = ?", gameID).Find(&attendance); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(attendance)
}

type UpdateAttendanceRequest struct {
	Status string `json:"status"` // "going", "not_going", "maybe"
}

func UpdateAttendance(w http.ResponseWriter, r *http.Request) {
	gameID, err := uuid.Parse(chi.URLParam(r, "gameID"))
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
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

	var req UpdateAttendanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := map[string]bool{"going": true, "not_going": true, "maybe": true}
	if !validStatuses[req.Status] {
		http.Error(w, "Invalid status. Must be 'going', 'not_going', or 'maybe'", http.StatusBadRequest)
		return
	}

	// Upsert attendance
	var attendance models.Attendance
	if result := database.DB.Where("team_member_id = ? AND game_id = ?", teamMember.ID, gameID).First(&attendance); result.Error != nil {
		// Create new attendance record
		attendance = models.Attendance{
			TeamMemberID: teamMember.ID,
			GameID:       gameID,
			Status:       req.Status,
			UpdatedAt:    time.Now(),
		}
		if result := database.DB.Create(&attendance); result.Error != nil {
			http.Error(w, result.Error.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		// Update existing attendance
		if result := database.DB.Model(&attendance).Updates(map[string]interface{}{
			"status":     req.Status,
			"updated_at": time.Now(),
		}); result.Error != nil {
			http.Error(w, result.Error.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func GetBattingOrder(w http.ResponseWriter, r *http.Request) {
	gameID, err := uuid.Parse(chi.URLParam(r, "gameID"))
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	var battingOrder []models.BattingOrder
	if result := database.DB.Preload("TeamMember.User").Where("game_id = ?", gameID).Order("batting_position").Find(&battingOrder); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(battingOrder)
}

func GetFieldingLineup(w http.ResponseWriter, r *http.Request) {
	gameID, err := uuid.Parse(chi.URLParam(r, "gameID"))
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	var fieldingLineup []models.FieldingLineup
	if result := database.DB.Preload("TeamMember.User").Where("game_id = ?", gameID).Order("inning, position").Find(&fieldingLineup); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(fieldingLineup)
}

type UpdateGameRequest struct {
	Date         string `json:"date,omitempty"`
	Time         string `json:"time,omitempty"`
	Location     string `json:"location,omitempty"`
	OpposingTeam string `json:"opposingTeam,omitempty"`
}

func UpdateGame(w http.ResponseWriter, r *http.Request) {
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

	var req UpdateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	updates := make(map[string]interface{})
	if req.Date != "" {
		if date, err := time.Parse("2006-01-02", req.Date); err == nil {
			updates["date"] = date
		} else {
			http.Error(w, "Invalid date format. Use YYYY-MM-DD", http.StatusBadRequest)
			return
		}
	}
	if req.Time != "" {
		updates["time"] = req.Time
	}
	if req.Location != "" {
		updates["location"] = req.Location
	}
	if req.OpposingTeam != "" {
		updates["opposing_team"] = req.OpposingTeam
	}

	if result := database.DB.Model(&game).Updates(updates); result.Error != nil {
		http.Error(w, "Failed to update game", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(game)
}

func DeleteGame(w http.ResponseWriter, r *http.Request) {
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

	if result := database.DB.Delete(&game); result.Error != nil {
		http.Error(w, "Failed to delete game", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type UpdateScoreRequest struct {
	FinalScore    int `json:"finalScore"`
	OpponentScore int `json:"opponentScore"`
}

func UpdateGameScore(w http.ResponseWriter, r *http.Request) {
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

	var req UpdateScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	updates := map[string]interface{}{
		"final_score":    req.FinalScore,
		"opponent_score": req.OpponentScore,
	}

	if result := database.DB.Model(&game).Updates(updates); result.Error != nil {
		http.Error(w, "Failed to update score", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(game)
}

type InningScore struct {
	Inning        int `json:"inning"`
	TeamScore     int `json:"teamScore"`
	OpponentScore int `json:"opponentScore"`
}

type UpdateInningScoresRequest struct {
	InningScores []InningScore `json:"inningScores"`
}

func UpdateInningScores(w http.ResponseWriter, r *http.Request) {
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

	var req UpdateInningScoresRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	for _, inningScore := range req.InningScores {
		if inningScore.Inning < 1 || inningScore.Inning > 7 {
			http.Error(w, "Inning must be between 1 and 7", http.StatusBadRequest)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

type FieldingLineupUpdateRequest struct {
	Lineups []FieldingLineupUpdate `json:"lineups"`
}

type FieldingLineupUpdate struct {
	ID           string    `json:"id"`
	GameID       uuid.UUID `json:"gameId"`
	Inning       int       `json:"inning"`
	TeamMemberID uuid.UUID `json:"teamMemberId"`
	Position     string    `json:"position"`
	IsGenerated  bool      `json:"isGenerated"`
	CreatedAt    time.Time `json:"createdAt"`
}

func UpdateFieldingLineup(w http.ResponseWriter, r *http.Request) {
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

	var req FieldingLineupUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete existing fielding lineup for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.FieldingLineup{}); result.Error != nil {
		http.Error(w, "Failed to clear existing lineup", http.StatusInternalServerError)
		return
	}

	// Create new fielding lineup entries
	for _, lineupUpdate := range req.Lineups {
		// Parse ID or generate new UUID for empty IDs or temporary IDs (bench assignments)
		var id uuid.UUID
		if lineupUpdate.ID == "" || lineupUpdate.ID == "00000000-0000-0000-0000-000000000000" || (len(lineupUpdate.ID) >= 5 && lineupUpdate.ID[:5] == "bench") {
			id = uuid.New()
		} else {
			id, err = uuid.Parse(lineupUpdate.ID)
			if err != nil {
				id = uuid.New() // Fallback to new UUID if parsing fails
			}
		}
		
		// Convert to model type
		lineup := models.FieldingLineup{
			ID:           id,
			GameID:       gameID,
			Inning:       lineupUpdate.Inning,
			TeamMemberID: lineupUpdate.TeamMemberID,
			Position:     lineupUpdate.Position,
			IsGenerated:  lineupUpdate.IsGenerated,
			CreatedAt:    time.Now(),
		}
		
		if result := database.DB.Create(&lineup); result.Error != nil {
			http.Error(w, "Failed to save lineup", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func DeleteFieldingLineup(w http.ResponseWriter, r *http.Request) {
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete fielding lineup for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.FieldingLineup{}); result.Error != nil {
		http.Error(w, "Failed to delete lineup", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type BattingOrderUpdateRequest struct {
	BattingOrder []models.BattingOrder `json:"battingOrder"`
}

func GenerateBattingOrder(w http.ResponseWriter, r *http.Request) {
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Call algorithm to generate batting order
	battingOrder, err := algorithms.GenerateBattingOrder(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete existing batting order for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to clear existing batting order", http.StatusInternalServerError)
		return
	}

	// Create new batting order entries
	for _, order := range battingOrder {
		if result := database.DB.Create(&order); result.Error != nil {
			http.Error(w, "Failed to save batting order", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(battingOrder)
}

func UpdateBattingOrder(w http.ResponseWriter, r *http.Request) {
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

	var req BattingOrderUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete existing batting order for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to clear existing batting order", http.StatusInternalServerError)
		return
	}

	// Create new batting order entries
	for _, order := range req.BattingOrder {
		order.GameID = gameID
		order.ID = uuid.New()
		order.CreatedAt = time.Now()
		
		if result := database.DB.Create(&order); result.Error != nil {
			http.Error(w, "Failed to save batting order", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func DeleteBattingOrder(w http.ResponseWriter, r *http.Request) {
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete batting order for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to delete batting order", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func GenerateFieldingLineup(w http.ResponseWriter, r *http.Request) {
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

	// Get inning from query params
	inningStr := r.URL.Query().Get("inning")
	if inningStr == "" {
		http.Error(w, "Inning parameter is required", http.StatusBadRequest)
		return
	}

	var inning int
	if _, err := fmt.Sscanf(inningStr, "%d", &inning); err != nil || inning < 1 || inning > 7 {
		http.Error(w, "Invalid inning (must be 1-7)", http.StatusBadRequest)
		return
	}

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Call algorithm to generate fielding lineup
	fieldingLineup, err := algorithms.GenerateFieldingLineup(gameID, inning)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete existing fielding lineup for this inning and game
	if result := database.DB.Where("game_id = ? AND inning = ?", gameID, inning).Delete(&models.FieldingLineup{}); result.Error != nil {
		http.Error(w, "Failed to clear existing fielding lineup", http.StatusInternalServerError)
		return
	}

	// Create new fielding lineup entries
	for _, lineup := range fieldingLineup {
		if result := database.DB.Create(&lineup); result.Error != nil {
			http.Error(w, "Failed to save fielding lineup", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(fieldingLineup)
}

func GenerateCompleteFieldingLineup(w http.ResponseWriter, r *http.Request) {
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Call algorithm to generate complete fielding lineup
	fieldingLineup, err := algorithms.GenerateCompleteFieldingLineup(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete existing fielding lineup for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.FieldingLineup{}); result.Error != nil {
		http.Error(w, "Failed to clear existing fielding lineup", http.StatusInternalServerError)
		return
	}

	// Create new fielding lineup entries
	for _, lineup := range fieldingLineup {
		if result := database.DB.Create(&lineup); result.Error != nil {
			http.Error(w, "Failed to save fielding lineup", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(fieldingLineup)
}
