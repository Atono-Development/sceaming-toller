package database

import (
	"fmt"
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

	// Ensure game constraints are cascading
	fixGameConstraints(DB)

	// Migrate game date to DATE type
	migrateGameDateToDateType(DB)
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

func fixGameConstraints(db *gorm.DB) {
	log.Println("Checking for game foreign key constraints to ensure CASCADE...")

	// Table and constraint mapping
	constraints := map[string][]string{
		"attendances":      {"fk_attendances_game"},
		"batting_orders":   {"fk_batting_orders_game"},
		"fielding_lineups": {"fk_fielding_lineups_game"},
		"inning_scores":    {"fk_inning_scores_game"},
	}

	for table, names := range constraints {
		for _, name := range names {
			// In PostgreSQL, we can use DROP CONSTRAINT IF EXISTS
			// and then ADD CONSTRAINT with ON DELETE CASCADE.
			err := db.Exec(fmt.Sprintf(`
				ALTER TABLE %s 
				DROP CONSTRAINT IF EXISTS %s,
				ADD CONSTRAINT %s 
				FOREIGN KEY (game_id) REFERENCES games(id) 
				ON DELETE CASCADE;
			`, table, name, name)).Error

			if err != nil {
				log.Printf("Warning: Failed to fix constraint %s on table %s: %v", name, table, err)
			} else {
				log.Printf("Fixed constraint %s on table %s (ON DELETE CASCADE)", name, table)
			}
		}
	}
}

func migrateGameDateToDateType(db *gorm.DB) {
	log.Println("Migrating games table date column to DATE type...")

	// We need to cast the existing TIMESTAMP WITH TIME ZONE to DATE.
	// We MUST cast it to UTC first to ensure that UTC midnight values
	// (like 2026-04-16 00:00:00 UTC) correctly become the date '2026-04-16'
	// instead of shifting to '2026-04-15' if cast in local PDT time.
	err := db.Exec(`
		ALTER TABLE games 
		ALTER COLUMN date TYPE DATE 
		USING (date AT TIME ZONE 'UTC')::DATE;
	`).Error

	if err != nil {
		log.Printf("Warning: Failed to migrate game date column: %v", err)
	} else {
		log.Println("Successfully migrated game date column to DATE type")
	}
}
