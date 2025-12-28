package algorithms

import (
	"errors"
	"math/rand"
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

	// 3. Separate by gender
	males := filterByGender(confirmed, "M")
	females := filterByGender(confirmed, "F")

	// 4. Get pitchers for this team
	pitchers := filterByRole(confirmed, "pitcher")
	pitcherIDs := make([]uuid.UUID, len(pitchers))
	for i, p := range pitchers {
		pitcherIDs[i] = p.ID
	}

	// 5. Alternate M-F
	var positions []BattingPosition
	if len(males) >= len(females) {
		positions = alternateGenders(males, females)
	} else {
		positions = alternateGenders(females, males)
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
