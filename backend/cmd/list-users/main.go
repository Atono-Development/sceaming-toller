package main

import (
	"fmt"
	"log"

	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

func main() {
	database.InitDB()

	var users []models.User
	if result := database.DB.Find(&users); result.Error != nil {
		log.Fatal(result.Error)
	}

	fmt.Println("Existing users:")
	for _, user := range users {
		fmt.Printf("- %s (%s)\n", user.Name, user.Email)
	}

	// Check team members
	var teamMembers []models.TeamMember
	if result := database.DB.Preload("User").Where("team_id = ?", "40d0f064-ddf3-4b26-a010-fe47b428118e").Find(&teamMembers); result.Error != nil {
		log.Fatal(result.Error)
	}

	fmt.Println("\nTeam members:")
	for _, tm := range teamMembers {
		fmt.Printf("- %s (%s) - %s, %s\n", tm.User.Name, tm.User.Email, tm.Gender, tm.Role)
	}
}
