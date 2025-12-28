package main

import (
	"log"

	"github.com/google/uuid"
	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func main() {
	database.InitDB()

	teamID := uuid.MustParse("40d0f064-ddf3-4b26-a010-fe47b428118e")
	gameID := uuid.MustParse("52de4a1b-ed36-4ddd-a4f7-4956b5f8cb01")

	// Get all team members
	var teamMembers []models.TeamMember
	if result := database.DB.Where("team_id = ? AND is_active = ?", teamID, true).Find(&teamMembers); result.Error != nil {
		log.Fatal(result.Error)
	}

	// Set attendance for all team members
	for _, tm := range teamMembers {
		attendance := models.Attendance{
			TeamMemberID: tm.ID,
			GameID:       gameID,
			Status:       "going",
		}
		
		// Delete existing attendance if any
		database.DB.Where("team_member_id = ? AND game_id = ?", tm.ID, gameID).Delete(&models.Attendance{})
		
		// Create new attendance
		if result := database.DB.Create(&attendance); result.Error != nil {
			log.Printf("Failed to set attendance for %s: %v", tm.User.Name, result.Error)
		} else {
			log.Printf("Set attendance for %s: going", tm.User.Name)
		}
	}
}
