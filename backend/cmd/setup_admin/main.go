package main

import (
	"log"
	"os"

	"github.com/liam/screaming-toller/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@localhost:5432/screaming_toller?sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database for setup")

	// 1. Set Super Admin
	email := "lstodd88+testtoller@gmail.com"
	var user models.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		log.Printf("User with email %s not found. Please register first, then run this script again.", email)
	} else {
		user.IsSuperAdmin = true
		if err := db.Save(&user).Error; err != nil {
			log.Fatalf("Failed to set Super Admin: %v", err)
		}
		log.Printf("User %s is now a Super Admin", email)
	}

	// 2. Migrate Teams to 'active'
	result := db.Model(&models.Team{}).Where("status = ? OR status IS NULL", "").Update("status", "active")
	if result.Error != nil {
		log.Fatalf("Failed to migrate teams: %v", result.Error)
	}
	log.Printf("Migrated %d teams to 'active' status", result.RowsAffected)

	log.Println("Setup completed successfully")
}
