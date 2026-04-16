package services

import (
	"fmt"
	"log"
	"time"

	"github.com/liam/screaming-toller/backend/internal/database"
	"github.com/liam/screaming-toller/backend/internal/models"
)

type ReminderService struct {
	emailService *EmailService
	location     *time.Location
}

func NewReminderService(emailService *EmailService) (*ReminderService, error) {
	loc, err := time.LoadLocation("America/Vancouver")
	if err != nil {
		log.Printf("Warning: Failed to load America/Vancouver timezone, falling back to local: %v", err)
		loc = time.Local
	}

	return &ReminderService{
		emailService: emailService,
		location:     loc,
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
		ticker := time.NewTicker(4 * time.Hour)
		for range ticker.C {
			s.ProcessUpcomingReminders()
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
}
