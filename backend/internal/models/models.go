package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string    `json:"name"`
	Email        string    `gorm:"uniqueIndex" json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

type Team struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	League      string    `json:"league"`
	Season      string    `json:"season"`
	IsActive    bool      `gorm:"default:true" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Membership  *TeamMember `gorm:"-" json:"membership,omitempty"`
}

func (t *Team) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return
}

type TeamMember struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TeamID   uuid.UUID `gorm:"type:uuid;index" json:"teamId"`
	UserID   uuid.UUID `gorm:"type:uuid;index" json:"userId"`
	Gender   string    `json:"gender"` // "M" or "F"
	Role     string    `json:"role"`   // "admin", "player", "pitcher"
	IsActive bool      `gorm:"default:true" json:"isActive"`
	JoinedAt time.Time `json:"joinedAt"`
	LeftAt   *time.Time `json:"leftAt,omitempty"`

	Team Team `gorm:"foreignKey:TeamID" json:"team,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	Preferences []TeamMemberPreference `gorm:"foreignKey:TeamMemberID" json:"preferences,omitempty"`
}

func (tm *TeamMember) BeforeCreate(tx *gorm.DB) (err error) {
	if tm.ID == uuid.Nil {
		tm.ID = uuid.New()
	}
	if tm.JoinedAt.IsZero() {
		tm.JoinedAt = time.Now()
	}
	return
}

type TeamMemberPreference struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TeamMemberID   uuid.UUID `gorm:"type:uuid;index" json:"teamMemberId"`
	Position       string    `json:"position"`
	PreferenceRank int       `json:"preferenceRank"` // 1, 2, or 3
}

func (tmp *TeamMemberPreference) BeforeCreate(tx *gorm.DB) (err error) {
	if tmp.ID == uuid.Nil {
		tmp.ID = uuid.New()
	}
	return
}

type Game struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TeamID        uuid.UUID `gorm:"type:uuid;index" json:"teamId"`
	Date          time.Time `gorm:"index" json:"date"`
	Time          string    `json:"time"`
	Location      string    `json:"location"`
	OpposingTeam  string    `json:"opposingTeam"`
	FinalScore    *int      `json:"finalScore,omitempty"`
	OpponentScore *int      `json:"opponentScore,omitempty"`
	Status        string    `gorm:"default:'scheduled'" json:"status"` // "scheduled", "in_progress", "completed", "cancelled"
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`

	Team Team `gorm:"foreignKey:TeamID" json:"team,omitempty"`
}

func (g *Game) BeforeCreate(tx *gorm.DB) (err error) {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return
}

type Attendance struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TeamMemberID uuid.UUID `gorm:"type:uuid;index" json:"teamMemberId"`
	GameID       uuid.UUID `gorm:"type:uuid;index" json:"gameId"`
	Status       string    `json:"status"` // "going", "not_going", "maybe"
	UpdatedAt    time.Time `json:"updatedAt"`

	TeamMember TeamMember `gorm:"foreignKey:TeamMemberID" json:"teamMember,omitempty"`
	Game       Game       `gorm:"foreignKey:GameID" json:"game,omitempty"`
}

func (a *Attendance) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return
}

type BattingOrder struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	GameID          uuid.UUID `gorm:"type:uuid;index" json:"gameId"`
	TeamMemberID    uuid.UUID `gorm:"type:uuid" json:"teamMemberId"`
	BattingPosition int       `json:"battingPosition"`
	IsGenerated     bool      `json:"isGenerated"`
	CreatedAt       time.Time `json:"createdAt"`

	Game       Game       `gorm:"foreignKey:GameID" json:"game,omitempty"`
	TeamMember TeamMember `gorm:"foreignKey:TeamMemberID" json:"teamMember,omitempty"`
}

func (bo *BattingOrder) BeforeCreate(tx *gorm.DB) (err error) {
	if bo.ID == uuid.Nil {
		bo.ID = uuid.New()
	}
	return
}

type FieldingLineup struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	GameID       uuid.UUID `gorm:"type:uuid;index" json:"gameId"`
	Inning       int       `json:"inning"` // 1-7
	TeamMemberID uuid.UUID `gorm:"type:uuid" json:"teamMemberId"`
	Position     string    `json:"position"` // "1B", "2B", "3B", "SS", "LF", "CF", "RF", "C", "Rover"
	IsGenerated  bool      `json:"isGenerated"`
	CreatedAt    time.Time `json:"createdAt"`

	Game       Game       `gorm:"foreignKey:GameID" json:"game,omitempty"`
	TeamMember TeamMember `gorm:"foreignKey:TeamMemberID" json:"teamMember,omitempty"`
}

func (fl *FieldingLineup) BeforeCreate(tx *gorm.DB) (err error) {
	if fl.ID == uuid.Nil {
		fl.ID = uuid.New()
	}
	return
}

type InningScore struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	GameID uuid.UUID `gorm:"type:uuid;index" json:"gameId"`
	Inning int       `json:"inning"`
	Score  int       `json:"score"`

	Game Game `gorm:"foreignKey:GameID" json:"game,omitempty"`
}

func (is *InningScore) BeforeCreate(tx *gorm.DB) (err error) {
	if is.ID == uuid.Nil {
		is.ID = uuid.New()
	}
	return
}

type Invitation struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	TeamID     uuid.UUID  `gorm:"type:uuid" json:"teamId"`
	Email      string     `json:"email"`
	Token      string     `gorm:"uniqueIndex" json:"token"`
	Role       string     `json:"role"` // "admin" or "player"
	ExpiresAt  time.Time  `json:"expiresAt"`
	AcceptedAt *time.Time `json:"acceptedAt,omitempty"`
	CreatedBy  uuid.UUID  `gorm:"type:uuid" json:"createdBy"` // UserID who sent invite
	CreatedAt  time.Time  `json:"createdAt"`

	Team Team `gorm:"foreignKey:TeamID" json:"team,omitempty"`
}

func (i *Invitation) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return
}
