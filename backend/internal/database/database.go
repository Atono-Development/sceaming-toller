package database

import (
	"log"
	"os"
	"strings"

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

	// Custom data migration for Roles
	migrateRoles(DB)
	
	// Custom data migration for Auth0
	migrateAuth0(DB)
}

func migrateRoles(db *gorm.DB) {
	var members []models.TeamMember
	// Find all members where role contains "admin" (case insensitive) and IsAdmin is false
	// We use %admin% to match "admin", "admin,pitcher", "pitcher,admin" etc.
	if err := db.Where("role ILIKE ? AND is_admin = ?", "%admin%", false).Find(&members).Error; err != nil {
		log.Printf("Failed to fetch members for role migration: %v", err)
		return
	}

	for _, member := range members {
		// Set IsAdmin to true
		member.IsAdmin = true
		
		// Remove "admin" from the role string to clean it up
		roles := strings.Split(member.Role, ",")
		var newRoles []string
		for _, r := range roles {
			r = strings.TrimSpace(r)
			if !strings.EqualFold(r, "admin") && r != "" {
				newRoles = append(newRoles, r)
			}
		}
		member.Role = strings.Join(newRoles, ",")

		if err := db.Save(&member).Error; err != nil {
			log.Printf("Failed to migrate member %s: %v", member.ID, err)
		} else {
			log.Printf("Migrated member %s (IsAdmin=true)", member.ID)
		}
	}
}

func migrateAuth0(db *gorm.DB) {
	// GORM's AutoMigrate does not drop columns.
	// We are doing a hard cutover to Auth0, so we drop the old password_hash column.
	if db.Migrator().HasColumn(&models.User{}, "password_hash") {
		log.Println("Dropping legacy password_hash column from users table...")
		err := db.Migrator().DropColumn(&models.User{}, "password_hash")
		if err != nil {
			log.Printf("Failed to drop password_hash column: %v", err)
		} else {
			log.Println("Successfully dropped password_hash column.")
		}
	}
}
