package services

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
	"github.com/liam/screaming-toller/backend/internal/utils"
)

type ReminderService struct {
	emailService    *EmailService
	whatsAppService *WhatsAppService // nil = disabled
	location        *time.Location
}

func NewReminderService(emailService *EmailService, whatsAppService *WhatsAppService) (*ReminderService, error) {
	loc, err := time.LoadLocation("America/Vancouver")
	if err != nil {
		log.Printf("Warning: Failed to load America/Vancouver timezone, falling back to local: %v", err)
		loc = time.Local
	}

	return &ReminderService{
		emailService:    emailService,
		whatsAppService: whatsAppService,
		location:        loc,
	}, nil
}

// StartScheduler starts the hybrid background scheduler
func (s *ReminderService) StartScheduler() {
	// 1. Initial check on startup
	go s.ProcessUpcomingReminders()

	// 2. Daily sweep ticker (every 24 hours) at a reasonable time (e.g., midnight PDT)
	go func() {
		for {
			// Calculate time until next midnight PDT
			now := time.Now().In(s.location)
			nextMidnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, s.location)
			duration := nextMidnight.Sub(now)

			log.Printf("ReminderService: Next daily sweep in %v", duration)
			time.Sleep(duration)
			s.ProcessUpcomingReminders()
		}
	}()

	// 3. Periodic check for safety (e.g., every 4 hours) to catch new games or missed windows
	go func() {
		const interval = 4 * time.Hour
		ticker := time.NewTicker(interval)
		log.Printf("ReminderService: Periodic check started. Next run in %v at %v", interval, time.Now().Add(interval).In(s.location).Format("15:04:05"))
		
		for t := range ticker.C {
			s.ProcessUpcomingReminders()
			log.Printf("ReminderService: Periodic check finished. Next run in %v at %v", interval, t.Add(interval).In(s.location).Format("15:04:05"))
		}
	}()
}

// ProcessUpcomingReminders finds games in the reminder window and sends emails
func (s *ReminderService) ProcessUpcomingReminders() {
	log.Println("ReminderService: Starting process...")

	// Find games occurring in the next 48 hours to be safe
	now := time.Now().In(s.location)

	var games []models.Game
	// We query by date primarily
	if err := database.DB.Where("date >= ? AND date <= ?", now.AddDate(0, 0, -1), now.AddDate(0, 0, 2)).Find(&games).Error; err != nil {
		log.Printf("ReminderService Error: Failed to fetch games: %v", err)
		return
	}

	for _, game := range games {
		// Calculate actual game time in PDT
		// game.Date is YYYY-MM-DD 00:00:00 UTC
		// game.Time is "HH:MM"
		var hour, min int
		n, _ := fmt.Sscanf(game.Time, "%d:%d", &hour, &min)
		if n < 2 {
			log.Printf("ReminderService Warning: Failed to parse time '%s' for game %s", game.Time, game.ID)
			continue
		}

		gameTimePDT := time.Date(game.Date.Year(), game.Date.Month(), game.Date.Day(), hour, min, 0, 0, s.location)
		
		// Target reminder window: 26 hours before to 2 hours before game time
		// This handles the 4-hour ticker frequency much better than a tight window.
		reminderWindowStart := gameTimePDT.Add(-26 * time.Hour)
		reminderWindowEnd := gameTimePDT.Add(-2 * time.Hour)
		log.Printf("ReminderService: Game %s (Time: %v, Window: %v to %v, Now: %v)", game.ID, gameTimePDT, reminderWindowStart, reminderWindowEnd, now)

		if now.After(reminderWindowStart) && now.Before(reminderWindowEnd) {
			s.sendRemindersForGame(game, gameTimePDT)
		} else {
			// Subtle log for debugging if needed, but maybe too noisy for production if there are many games
			// log.Printf("ReminderService: Game %s skipped (Time: %v, Window: %v to %v, Now: %v)", game.ID, gameTimePDT, reminderWindowStart, reminderWindowEnd, now)
		}
	}
}

func (s *ReminderService) sendRemindersForGame(game models.Game, gameTime time.Time) {
	log.Printf("ReminderService: Processing reminders for game: %s vs %s", game.ID, game.OpposingTeam)

	var attendances []models.Attendance
	if err := database.DB.Preload("TeamMember.User").Preload("TeamMember.Team").
		Where("game_id = ? AND status = ? AND reminder_sent_at IS NULL", game.ID, "maybe").
		Find(&attendances).Error; err != nil {
		log.Printf("ReminderService Error: Failed to fetch attendances for game %s: %v", game.ID, err)
		return
	}

	if len(attendances) > 0 {
		log.Printf("ReminderService: Found %d 'maybe' players to remind for game %s", len(attendances), game.ID)
	} else {
		log.Printf("ReminderService: No 'maybe' players to remind (or reminders already sent) for game %s", game.ID)
	}

	for _, att := range attendances {
		// Throttling: Always sleep before each request attempt (even if the previous one failed)
		// to stay reliably under the 5 emails/second rate limit.
		time.Sleep(250 * time.Millisecond)

		user := att.TeamMember.User
		team := att.TeamMember.Team

		if user.OptOutReminders {
			log.Printf("ReminderService: Skipping user %s (opted out)", user.Email)
			continue
		}

		// Send email
		gameDateStr := gameTime.Format("Monday, Jan 2")
		gameTimeStr := gameTime.Format("3:04 PM")
		
		err := s.emailService.SendAttendanceReminderEmail(
			user.Email,
			team.Name,
			game.OpposingTeam,
			gameDateStr,
			gameTimeStr,
			game.Location,
			team.ID.String(),
		)

		if err != nil {
			log.Printf("ReminderService Error: Failed to send email to %s: %v", user.Email, err)
			continue
		}

		// Mark as sent
		now := time.Now()
		att.ReminderSentAt = &now
		database.DB.Save(&att)
		log.Printf("ReminderService: Reminder sent to %s", user.Email)
	}

	// After all individual emails, send a single WhatsApp group reminder
	s.sendWhatsAppGroupReminder(game, gameTime)
}

// sendWhatsAppGroupReminder posts one message to the team's WhatsApp group listing
// all 'maybe' players (by name) for the given game. Idempotent — skips if already sent.
func (s *ReminderService) sendWhatsAppGroupReminder(game models.Game, gameTime time.Time) {
	if s.whatsAppService == nil {
		return
	}

	// Already sent for this game?
	if game.WhatsAppReminderSentAt != nil {
		log.Printf("ReminderService: WhatsApp reminder already sent for game %s, skipping", game.ID)
		return
	}

	// Load the team to get its WhatsApp group ID
	var team models.Team
	if err := database.DB.First(&team, "id = ?", game.TeamID).Error; err != nil {
		log.Printf("ReminderService Error: Could not load team for game %s: %v", game.ID, err)
		return
	}

	if team.WhatsAppGroupID == "" {
		log.Printf("ReminderService: No WhatsApp group configured for team %s, skipping", team.Name)
		return
	}

	if team.WhapiTokenSourceUserID == nil {
		log.Printf("ReminderService: No WhatsApp API key source configured for team %s, skipping", team.Name)
		return
	}

	// Load the source user to get the encrypted token
	var sourceUser models.User
	if err := database.DB.First(&sourceUser, "id = ?", team.WhapiTokenSourceUserID).Error; err != nil {
		log.Printf("ReminderService Error: Could not load token source user for team %s: %v", team.Name, err)
		return
	}

	if sourceUser.WhapiToken == "" {
		log.Printf("ReminderService: Token source user %s has no Whapi token set, skipping", sourceUser.Name)
		return
	}

	// Decrypt the token
	token, err := utils.Decrypt(sourceUser.WhapiToken)
	if err != nil {
		log.Printf("ReminderService Error: Failed to decrypt Whapi token for team %s: %v", team.Name, err)
		return
	}

	// Collect names of all still-unconfirmed players
	var attendances []models.Attendance
	if err := database.DB.Preload("TeamMember.User").
		Where("game_id = ? AND status = ?", game.ID, "maybe").
		Find(&attendances).Error; err != nil {
		log.Printf("ReminderService Error: Failed to fetch attendances for WA reminder (game %s): %v", game.ID, err)
		return
	}

	if len(attendances) == 0 {
		log.Printf("ReminderService: No 'maybe' players for WA reminder (game %s)", game.ID)
		return
	}

	var names []string
	for _, att := range attendances {
		if att.TeamMember.User.OptOutReminders {
			continue
		}
		names = append(names, att.TeamMember.User.Name)
	}

	if len(names) == 0 {
		log.Printf("ReminderService: All 'maybe' players opted out, skipping WA reminder (game %s)", game.ID)
		return
	}

	gameDateStr := gameTime.Format("Monday, Jan 2")
	gameTimeStr := gameTime.Format("3:04 PM")
	attendanceURL := fmt.Sprintf("%s/teams/%s/games", getAppURL(), team.ID.String())

	message := fmt.Sprintf(
		"🥎 *Attendance Reminder — %s vs %s*\n📅 %s at %s\n📍 %s\n\nThe following players haven't confirmed yet:\n%s\n\nPlease update your attendance: %s",
		team.Name,
		game.OpposingTeam,
		gameDateStr,
		gameTimeStr,
		game.Location,
		"• "+strings.Join(names, "\n• "),
		attendanceURL,
	)

	if err := s.whatsAppService.SendGroupMessage(token, team.WhatsAppGroupID, message); err != nil {
		log.Printf("ReminderService Error: Failed to send WhatsApp group reminder for game %s: %v", game.ID, err)
		return
	}

	// Mark game as WA-reminded
	now := time.Now()
	game.WhatsAppReminderSentAt = &now
	database.DB.Save(&game)
	log.Printf("ReminderService: WhatsApp group reminder sent for game %s to group %s (%d players)", game.ID, team.WhatsAppGroupID, len(names))
}

// getAppURL returns the APP_URL env var with a safe fallback.
func getAppURL() string {
	if url := os.Getenv("APP_URL"); url != "" {
		return url
	}
	return "http://localhost:5173"
}
