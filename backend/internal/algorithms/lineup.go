package algorithms

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

type BattingPosition struct {
	TeamMemberID uuid.UUID
	Position     int
}

// GenerateBattingOrder creates a batting order based on attendance and gender balance rules
func GenerateBattingOrder(gameID uuid.UUID) ([]models.BattingOrder, error) {
	// 1. Get attendance for this game
	var attendance []models.Attendance
	if result := database.DB.Where("game_id = ? AND status = ?", gameID, "going").
		Preload("TeamMember").
		Find(&attendance); result.Error != nil {
		return nil, result.Error
	}

	if len(attendance) < 9 {
		return nil, errors.New("insufficient players: need at least 9 confirmed")
	}

	// 2. Extract team members from attendance
	confirmed := make([]models.TeamMember, len(attendance))
	for i, att := range attendance {
		confirmed[i] = att.TeamMember
	}

	// 3. Separate by gender and shuffle for randomness
	males := filterByGender(confirmed, "M")
	females := filterByGender(confirmed, "F")
	
	// Shuffle each gender group to add randomness
	rand.Shuffle(len(males), func(i, j int) {
		males[i], males[j] = males[j], males[i]
	})
	rand.Shuffle(len(females), func(i, j int) {
		females[i], females[j] = females[j], females[i]
	})

	// 4. Get pitchers for this team
	pitchers := filterByRole(confirmed, "pitcher")
	pitcherIDs := make([]uuid.UUID, len(pitchers))
	for i, p := range pitchers {
		pitcherIDs[i] = p.ID
	}

	// 5. Alternate M-F with random starting gender
	var positions []BattingPosition
	// Randomly decide which gender starts the batting order
	if rand.Intn(2) == 0 && len(males) >= len(females) {
		positions = alternateGenders(males, females)
	} else if len(males) >= len(females) {
		positions = alternateGenders(females, males)
	} else if rand.Intn(2) == 0 {
		positions = alternateGenders(females, males)
	} else {
		positions = alternateGenders(males, females)
	}

	// 6. Space out pitchers
	if len(pitchers) == 2 {
		positions = spacePitchers(positions, pitcherIDs)
	}

	// 7. Convert to BattingOrder models
	result := make([]models.BattingOrder, len(positions))
	for i, pos := range positions {
		result[i] = models.BattingOrder{
			GameID:          gameID,
			TeamMemberID:    pos.TeamMemberID,
			BattingPosition: pos.Position,
			IsGenerated:     true,
		}
	}

	return result, nil
}

func filterByGender(members []models.TeamMember, gender string) []models.TeamMember {
	result := make([]models.TeamMember, 0)
	for _, m := range members {
		if m.Gender == gender && m.IsActive {
			result = append(result, m)
		}
	}
	return result
}

func filterByRole(members []models.TeamMember, role string) []models.TeamMember {
	result := make([]models.TeamMember, 0)
	for _, m := range members {
		if containsRole(m.Role, role) && m.IsActive {
			result = append(result, m)
		}
	}
	return result
}

func containsRole(memberRole, role string) bool {
	return containsIgnoreCase(memberRole, role)
}

func containsIgnoreCase(s, substr string) bool {
	s = strings.ToLower(s)
	substr = strings.ToLower(substr)
	return strings.Contains(s, substr)
}

func alternateGenders(primary, secondary []models.TeamMember) []BattingPosition {
	var positions []BattingPosition
	i, j := 0, 0
	
	for i < len(primary) || j < len(secondary) {
		if i < len(primary) {
			positions = append(positions, BattingPosition{
				TeamMemberID: primary[i].ID,
				Position:     len(positions) + 1,
			})
			i++
		}
		if j < len(secondary) {
			positions = append(positions, BattingPosition{
				TeamMemberID: secondary[j].ID,
				Position:     len(positions) + 1,
			})
			j++
		}
	}
	
	return positions
}

func spacePitchers(positions []BattingPosition, pitcherIDs []uuid.UUID) []BattingPosition {
	if len(pitcherIDs) != 2 {
		return positions
	}

	// Find positions of pitchers
	var pitcherPositions []int
	for i, pos := range positions {
		for _, pitcherID := range pitcherIDs {
			if pos.TeamMemberID == pitcherID {
				pitcherPositions = append(pitcherPositions, i)
				break
			}
		}
	}

	if len(pitcherPositions) != 2 {
		return positions
	}

	// Calculate ideal spacing (roughly 1/3 of the lineup apart)
	idealSpacing := len(positions) / 3
	currentSpacing := pitcherPositions[1] - pitcherPositions[0]

	// If pitchers are too close, try to space them better
	if currentSpacing < idealSpacing {
		// Simple approach: move second pitcher to ideal spacing position
		idealPos := pitcherPositions[0] + idealSpacing
		if idealPos < len(positions) {
			// Swap the second pitcher with the player at the ideal position
			positions[pitcherPositions[1]], positions[idealPos] = positions[idealPos], positions[pitcherPositions[1]]
		}
	}

	return positions
}

// GenerateFieldingLineup creates a fielding lineup for a specific inning
func GenerateFieldingLineup(gameID uuid.UUID, inning int) ([]models.FieldingLineup, error) {
	// 1. Get attendance for this game
	var attendance []models.Attendance
	if result := database.DB.Where("game_id = ? AND status = ?", gameID, "going").
		Preload("TeamMember").
		Preload("TeamMember.Preferences").
		Find(&attendance); result.Error != nil {
		return nil, result.Error
	}

	if len(attendance) < 9 {
		return nil, errors.New("insufficient players")
	}

	confirmed := make([]models.TeamMember, len(attendance))
	for i, att := range attendance {
		confirmed[i] = att.TeamMember
	}

	// 2. Separate by gender
	males := filterByGender(confirmed, "M")
	females := filterByGender(confirmed, "F")

	// 3. Select 9 with 5-4 split
	var selected []models.TeamMember
	if len(males) >= 5 && len(females) >= 4 {
		selected = append(selectN(males, 5), selectN(females, 4)...)
	} else if len(females) >= 5 && len(males) >= 4 {
		selected = append(selectN(females, 5), selectN(males, 4)...)
	} else {
		return nil, errors.New("cannot achieve 5-4 split")
	}

	positions := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"}

	assignments := make([]models.FieldingLineup, 0, 9)
	assignedPlayers := make(map[uuid.UUID]bool)
	assignedPositions := make(map[string]bool)

	// 4. First pass: assign based on team-specific preferences
	for _, pos := range positions {
		if assignedPositions[pos] {
			continue
		}

		for _, member := range selected {
			if assignedPlayers[member.ID] {
				continue
			}

			// Check if this position is in member's preferences
			if hasPreferredPosition(member, pos) {
				assignments = append(assignments, models.FieldingLineup{
					GameID:       gameID,
					TeamMemberID: member.ID,
					Position:     pos,
					Inning:       inning,
					IsGenerated:  true,
				})
				assignedPlayers[member.ID] = true
				assignedPositions[pos] = true
				break
			}
		}
	}

	// 5. Second pass: fill remaining positions
	for _, pos := range positions {
		if assignedPositions[pos] {
			continue
		}

		for _, member := range selected {
			if assignedPlayers[member.ID] {
				continue
			}

			assignments = append(assignments, models.FieldingLineup{
				GameID:       gameID,
				TeamMemberID: member.ID,
				Position:     pos,
				Inning:       inning,
				IsGenerated:  true,
			})
			assignedPlayers[member.ID] = true
			assignedPositions[pos] = true
			break
		}
	}

	return assignments, nil
}

func hasPreferredPosition(member models.TeamMember, position string) bool {
	for _, pref := range member.Preferences {
		if pref.Position == position {
			return true
		}
	}
	return false
}

func selectN(members []models.TeamMember, n int) []models.TeamMember {
	if len(members) <= n {
		return members
	}

	// Shuffle and take first n
	shuffled := make([]models.TeamMember, len(members))
	copy(shuffled, members)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	return shuffled[:n]
}

// PlayerInningTrack tracks how many innings each player has played
type PlayerInningTrack struct {
	TeamMemberID    uuid.UUID
	InningsPlayed   int
	PositionsPlayed []string
	LastSatOutInning int // Track which inning they last sat out
}

// GenerateCompleteFieldingLineup creates fielding lineups for all 7 innings with even playing time
func GenerateCompleteFieldingLineup(gameID uuid.UUID) ([]models.FieldingLineup, error) {
	// 1. Get attendance for this game
	var attendance []models.Attendance
	if result := database.DB.Where("game_id = ? AND status = ?", gameID, "going").
		Preload("TeamMember").
		Preload("TeamMember.Preferences").
		Find(&attendance); result.Error != nil {
		return nil, result.Error
	}

	if len(attendance) < 9 {
		return nil, errors.New("insufficient players: need at least 9 confirmed")
	}

	confirmed := make([]models.TeamMember, len(attendance))
	for i, att := range attendance {
		confirmed[i] = att.TeamMember
	}

	// 2. Separate by gender
	males := filterByGender(confirmed, "M")
	females := filterByGender(confirmed, "F")

	// 3. Check if we have enough for 5-4 split
	if len(males) < 4 || len(females) < 4 {
		return nil, errors.New("need at least 4 males and 4 females for proper gender balance")
	}

	// 4. Initialize player tracking
	playerTracks := make(map[uuid.UUID]*PlayerInningTrack)
	for _, member := range confirmed {
		playerTracks[member.ID] = &PlayerInningTrack{
			TeamMemberID:     member.ID,
			InningsPlayed:    0,
			PositionsPlayed:  make([]string, 0),
			LastSatOutInning: -1, // -1 means they haven't sat out yet
		}
	}

	// 5. Generate lineups for all 7 innings
	var allLineups []models.FieldingLineup
	positions := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"}

	for inning := 1; inning <= 7; inning++ {
		lineup, err := generateBalancedInningLineup(gameID, inning, confirmed, playerTracks, positions)
		if err != nil {
			return nil, err
		}
		allLineups = append(allLineups, lineup...)
	}

	return allLineups, nil
}

// generateBalancedInningLineup generates a single inning lineup trying to balance playing time
func generateBalancedInningLineup(gameID uuid.UUID, inning int, confirmed []models.TeamMember, 
	playerTracks map[uuid.UUID]*PlayerInningTrack, positions []string) ([]models.FieldingLineup, error) {
	
	// Sort players by innings played (ascending) to prioritize those who've played less
	sortedPlayers := make([]models.TeamMember, len(confirmed))
	copy(sortedPlayers, confirmed)
	
	sort.Slice(sortedPlayers, func(i, j int) bool {
		inningsI := playerTracks[sortedPlayers[i].ID].InningsPlayed
		inningsJ := playerTracks[sortedPlayers[j].ID].InningsPlayed
		if inningsI != inningsJ {
			return inningsI < inningsJ
		}
		// If equal innings, prioritize those who sat out most recently
		satOutI := playerTracks[sortedPlayers[i].ID].LastSatOutInning
		satOutJ := playerTracks[sortedPlayers[j].ID].LastSatOutInning
		if satOutI != satOutJ {
			return satOutI > satOutJ // More recent sit out gets priority
		}
		// If still equal, sort by name for consistency
		return sortedPlayers[i].ID.String() < sortedPlayers[j].ID.String()
	})

	// Select 9 players with 5-4 gender balance, prioritizing those who've played less
	selected, err := selectBalancedTeam(sortedPlayers, playerTracks)
	if err != nil {
		return nil, err
	}

	// Assign positions
	assignments := make([]models.FieldingLineup, 0, 9)
	assignedPlayers := make(map[uuid.UUID]bool)
	assignedPositions := make(map[string]bool)

	// First pass: assign based on preferences
	for _, pos := range positions {
		if assignedPositions[pos] {
			continue
		}

		// Find the best player for this position who hasn't been assigned yet
		var bestPlayer *models.TeamMember
		bestPriority := 100 // high number

		for i, member := range selected {
			if assignedPlayers[member.ID] {
				continue
			}

			// Check if this position is in member's preferences
			prefRank := getPreferenceRank(member, pos)
			if prefRank > 0 && prefRank < bestPriority {
				// Also consider playing time balance
				inningsPlayed := playerTracks[member.ID].InningsPlayed
				if inningsPlayed < 6 { // Don't exceed 6 innings for any player
					bestPlayer = &selected[i]
					bestPriority = prefRank
				}
			}
		}

		if bestPlayer != nil {
			assignments = append(assignments, models.FieldingLineup{
				GameID:       gameID,
				TeamMemberID: bestPlayer.ID,
				Position:     pos,
				Inning:       inning,
				IsGenerated:  true,
			})
			assignedPlayers[bestPlayer.ID] = true
			assignedPositions[pos] = true
			
			// Update player tracking
			playerTracks[bestPlayer.ID].InningsPlayed++
			playerTracks[bestPlayer.ID].PositionsPlayed = append(playerTracks[bestPlayer.ID].PositionsPlayed, pos)
		}
	}

	// Second pass: fill remaining positions with players who've played least
	for _, pos := range positions {
		if assignedPositions[pos] {
			continue
		}

		// Find player with least innings who hasn't been assigned
		var bestPlayer *models.TeamMember
		minInnings := 100

		for i, member := range selected {
			if assignedPlayers[member.ID] {
				continue
			}

			inningsPlayed := playerTracks[member.ID].InningsPlayed
			if inningsPlayed < minInnings && inningsPlayed < 6 {
				minInnings = inningsPlayed
				bestPlayer = &selected[i]
			}
		}

		if bestPlayer != nil {
			assignments = append(assignments, models.FieldingLineup{
				GameID:       gameID,
				TeamMemberID: bestPlayer.ID,
				Position:     pos,
				Inning:       inning,
				IsGenerated:  true,
			})
			assignedPlayers[bestPlayer.ID] = true
			assignedPositions[pos] = true
			
			// Update player tracking
			playerTracks[bestPlayer.ID].InningsPlayed++
			playerTracks[bestPlayer.ID].PositionsPlayed = append(playerTracks[bestPlayer.ID].PositionsPlayed, pos)
		}
	}

	// Update player tracking for those who sat out this inning
	selectedIDs := make(map[uuid.UUID]bool)
	for _, selectedPlayer := range selected {
		selectedIDs[selectedPlayer.ID] = true
	}
	
	for _, member := range confirmed {
		if !selectedIDs[member.ID] {
			playerTracks[member.ID].LastSatOutInning = inning
		}
	}

	return assignments, nil
}

// selectBalancedTeam selects 9 players with 5-4 gender balance from available players
func selectBalancedTeam(sortedPlayers []models.TeamMember, playerTracks map[uuid.UUID]*PlayerInningTrack) ([]models.TeamMember, error) {
	males := make([]models.TeamMember, 0)
	females := make([]models.TeamMember, 0)

	// Separate by gender and filter out players who've already played 6+ innings
	for _, member := range sortedPlayers {
		if playerTracks[member.ID].InningsPlayed >= 6 {
			continue
		}
		if member.Gender == "M" {
			males = append(males, member)
		} else if member.Gender == "F" {
			females = append(females, member)
		}
	}

	// Debug: print counts
	if len(males) < 5 && len(females) < 5 {
		return nil, errors.New(fmt.Sprintf("cannot achieve 5-4 split: %d males, %d females available", len(males), len(females)))
	}

	// Sort males and females by innings played (ascending) to ensure fair rotation
	sort.Slice(males, func(i, j int) bool {
		inningsI := playerTracks[males[i].ID].InningsPlayed
		inningsJ := playerTracks[males[j].ID].InningsPlayed
		return inningsI < inningsJ
	})
	
	sort.Slice(females, func(i, j int) bool {
		inningsI := playerTracks[females[i].ID].InningsPlayed
		inningsJ := playerTracks[females[j].ID].InningsPlayed
		return inningsI < inningsJ
	})
	
	// Try different combinations for 5-4 split, prioritizing balance
	var selected []models.TeamMember
	
	// Calculate total available players
	totalAvailable := len(males) + len(females)
	if totalAvailable < 9 {
		return nil, errors.New("not enough players available")
	}
	
	// Strategy 1: Try 5 males, 4 females
	if len(males) >= 5 && len(females) >= 4 {
		selected = append(selectN(males, 5), selectN(females, 4)...)
	} else if len(females) >= 5 && len(males) >= 4 {
		// Strategy 2: Try 5 females, 4 males
		selected = append(selectN(females, 5), selectN(males, 4)...)
	} else {
		return nil, errors.New("cannot achieve 5-4 gender split with available players")
	}

	return selected, nil
}

// getPreferenceRank returns the preference rank (1, 2, 3) for a position, or 0 if not preferred
func getPreferenceRank(member models.TeamMember, position string) int {
	for _, pref := range member.Preferences {
		if pref.Position == position {
			return pref.PreferenceRank
		}
	}
	return 0
}
