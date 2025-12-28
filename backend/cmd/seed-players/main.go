package main

import (
	"fmt"
	"log"
	"math/rand"

	"github.com/google/uuid"

	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func main() {
	// Initialize Database
	database.InitDB()

	// Team ID (using the existing team from the logs)
	teamID := uuid.MustParse("40d0f064-ddf3-4b26-a010-fe47b428118e")

	// Fielding positions
	positions := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Rover"}

	// Create 10 players with 50/50 gender split
	for i := 1; i <= 10; i++ {
		gender := "M"
		if i > 5 {
			gender = "F"
		}

		// Create user
		user := models.User{
			Name:  fmt.Sprintf("Player %d", i),
			Email: fmt.Sprintf("player%d@test.com", i),
			PasswordHash: "hashed_password", // In real app, this would be properly hashed
		}

		if result := database.DB.Create(&user); result.Error != nil {
			log.Printf("Failed to create user %d: %v", i, result.Error)
			continue
		}

		// Create team member
		role := "player"
		if i <= 2 { // Make first 2 players pitchers
			role = "pitcher"
		}

		teamMember := models.TeamMember{
			TeamID:   teamID,
			UserID:   user.ID,
			Gender:   gender,
			Role:     role,
			IsActive: true,
		}

		if result := database.DB.Create(&teamMember); result.Error != nil {
			log.Printf("Failed to create team member %d: %v", i, result.Error)
			continue
		}

		// Create 3 random position preferences
		shuffledPositions := shufflePositions(positions)
		for j := 0; j < 3; j++ {
			preference := models.TeamMemberPreference{
				TeamMemberID:   teamMember.ID,
				Position:       shuffledPositions[j],
				PreferenceRank: j + 1,
			}
			if result := database.DB.Create(&preference); result.Error != nil {
				log.Printf("Failed to create preference for player %d: %v", i, result.Error)
			}
		}

		fmt.Printf("Created player %d: %s (%s) - Role: %s\n", i, user.Name, gender, role)
		fmt.Printf("  Preferences: %s, %s, %s\n", 
			shuffledPositions[0], shuffledPositions[1], shuffledPositions[2])
	}

	fmt.Println("Successfully populated 10 players!")
}

func shufflePositions(positions []string) []string {
	shuffled := make([]string, len(positions))
	copy(shuffled, positions)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	return shuffled
}
