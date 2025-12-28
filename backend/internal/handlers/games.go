package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"github.com/liam/screaming-toller/backend/internal/algorithms"
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

	// Delete existing batting order for this game
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to clear existing batting order", http.StatusInternalServerError)
		return
	}

	// Generate new batting order
	battingOrder, err := algorithms.GenerateBattingOrder(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to database
	if result := database.DB.Create(&battingOrder); result.Error != nil {
		http.Error(w, "Failed to save batting order", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(battingOrder)
}

type UpdateBattingOrderRequest struct {
	BattingOrder []models.BattingOrder `json:"battingOrder"`
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	var req UpdateBattingOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate batting order
	if err := validateBattingOrder(req.BattingOrder); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Delete existing batting order
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to clear existing batting order", http.StatusInternalServerError)
		return
	}

	// Set game ID and create new batting order
	for i := range req.BattingOrder {
		req.BattingOrder[i].GameID = gameID
		req.BattingOrder[i].IsGenerated = false // Mark as manually edited
	}

	// Save to database
	if result := database.DB.Create(&req.BattingOrder); result.Error != nil {
		http.Error(w, "Failed to save batting order", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req.BattingOrder)
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

	// Delete batting order
	if result := database.DB.Where("game_id = ?", gameID).Delete(&models.BattingOrder{}); result.Error != nil {
		http.Error(w, "Failed to delete batting order", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func validateBattingOrder(battingOrder []models.BattingOrder) error {
	if len(battingOrder) < 9 {
		return errors.New("batting order must have at least 9 players")
	}

	// Check for duplicate positions
	positions := make(map[int]bool)
	for _, bo := range battingOrder {
		if positions[bo.BattingPosition] {
			return errors.New("duplicate batting position found")
		}
		positions[bo.BattingPosition] = true
	}

	// TODO: Add gender alternation validation if needed
	// This would require loading the team members to check genders

	return nil
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

	// Get inning from query parameter (default to 1)
	inningStr := r.URL.Query().Get("inning")
	inning := 1
	if inningStr != "" {
		if inning, err = strconv.Atoi(inningStr); err != nil || inning < 1 || inning > 7 {
			http.Error(w, "Invalid inning. Must be between 1 and 7", http.StatusBadRequest)
			return
		}
	}

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete existing fielding lineup for this inning
	if result := database.DB.Where("game_id = ? AND inning = ?", gameID, inning).Delete(&models.FieldingLineup{}); result.Error != nil {
		http.Error(w, "Failed to clear existing fielding lineup", http.StatusInternalServerError)
		return
	}

	// Generate new fielding lineup
	fieldingLineup, err := algorithms.GenerateFieldingLineup(gameID, inning)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to database
	if result := database.DB.Create(&fieldingLineup); result.Error != nil {
		http.Error(w, "Failed to save fielding lineup", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(fieldingLineup)
}

type UpdateFieldingLineupRequest struct {
	FieldingLineup []models.FieldingLineup `json:"fieldingLineup"`
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

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	var req UpdateFieldingLineupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate fielding lineup
	if err := validateFieldingLineup(req.FieldingLineup); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Group by inning and delete existing lineups for those innings
	innings := make(map[int]bool)
	for _, fl := range req.FieldingLineup {
		innings[fl.Inning] = true
	}

	for inning := range innings {
		if result := database.DB.Where("game_id = ? AND inning = ?", gameID, inning).Delete(&models.FieldingLineup{}); result.Error != nil {
			http.Error(w, "Failed to clear existing fielding lineup", http.StatusInternalServerError)
			return
		}
	}

	// Set game ID and create new fielding lineup
	for i := range req.FieldingLineup {
		req.FieldingLineup[i].GameID = gameID
		req.FieldingLineup[i].IsGenerated = false // Mark as manually edited
	}

	// Save to database
	if result := database.DB.Create(&req.FieldingLineup); result.Error != nil {
		http.Error(w, "Failed to save fielding lineup", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req.FieldingLineup)
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

	// Get inning from query parameter (optional - if not provided, delete all innings)
	inningStr := r.URL.Query().Get("inning")

	// Verify game belongs to team
	var game models.Game
	if result := database.DB.Where("id = ? AND team_id = ?", gameID, teamID).First(&game); result.Error != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	var result *gorm.DB
	if inningStr != "" {
		// Delete specific inning
		inning, err := strconv.Atoi(inningStr)
		if err != nil || inning < 1 || inning > 7 {
			http.Error(w, "Invalid inning. Must be between 1 and 7", http.StatusBadRequest)
			return
		}
		result = database.DB.Where("game_id = ? AND inning = ?", gameID, inning).Delete(&models.FieldingLineup{})
	} else {
		// Delete all innings for this game
		result = database.DB.Where("game_id = ?", gameID).Delete(&models.FieldingLineup{})
	}

	if result.Error != nil {
		http.Error(w, "Failed to delete fielding lineup", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func validateFieldingLineup(fieldingLineup []models.FieldingLineup) error {
	// Group by inning
	innings := make(map[int][]models.FieldingLineup)
	for _, fl := range fieldingLineup {
		if fl.Inning < 1 || fl.Inning > 7 {
			return errors.New("inning must be between 1 and 7")
		}
		innings[fl.Inning] = append(innings[fl.Inning], fl)
	}

	// Validate each inning has exactly 9 players with unique positions
	validPositions := map[string]bool{"C": true, "1B": true, "2B": true, "3B": true, "SS": true, "LF": true, "CF": true, "RF": true, "Rover": true}

	for inning, lineup := range innings {
		if len(lineup) != 9 {
			return errors.New("each inning must have exactly 9 players")
		}

		// Check for duplicate positions and invalid positions
		positions := make(map[string]bool)
		for _, fl := range lineup {
			if !validPositions[fl.Position] {
				return errors.New("invalid position: " + fl.Position)
			}
			if positions[fl.Position] {
				return errors.New("duplicate position found in inning " + strconv.Itoa(inning) + ": " + fl.Position)
			}
			positions[fl.Position] = true
		}
	}

	// TODO: Add 5-4 gender split validation if needed
	// This would require loading the team members to check genders

	return nil
}
