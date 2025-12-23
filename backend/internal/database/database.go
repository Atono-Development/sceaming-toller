package database

import (
	"log"
	"os"

	"github.com/liam/screaming-toller/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@db:5432/screaming_toller?sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database")

	// Auto-migrate models
	err = DB.AutoMigrate(
		&models.User{},
		&models.Team{},
		&models.TeamMember{},
		&models.TeamMemberPreference{},
		&models.Game{},
		&models.Attendance{},
		&models.BattingOrder{},
		&models.FieldingLineup{},
		&models.InningScore{},
		&models.Invitation{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Database migration completed")
}
