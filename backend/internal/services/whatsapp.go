package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

const whapiBaseURL = "https://gate.whapi.cloud"

// WhatsAppService sends messages via the Whapi.Cloud REST API.
type WhatsAppService struct {
	token      string
	httpClient *http.Client
}

// NewWhatsAppService creates a WhatsAppService from the WHAPI_TOKEN env var.
// Returns nil (not an error) when the token is absent so callers can treat WA as optional.
func NewWhatsAppService() *WhatsAppService {
	token := os.Getenv("WHAPI_TOKEN")
	if token == "" {
		log.Println("WhatsAppService: WHAPI_TOKEN not set — WhatsApp reminders disabled")
		return nil
	}
	return &WhatsAppService{
		token:      token,
		httpClient: &http.Client{},
	}
}

// sendTextMessageRequest is the Whapi POST /messages/text body.
type sendTextMessageRequest struct {
	To   string `json:"to"`
	Body string `json:"body"`
}

// SendGroupMessage sends a plain-text message to a WhatsApp group.
// groupID is the Whapi chat ID, e.g. "120363xxxxxx@g.us".
func (s *WhatsAppService) SendGroupMessage(groupID, body string) error {
	payload := sendTextMessageRequest{
		To:   groupID,
		Body: body,
	}

	b, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("whatsapp: failed to marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, whapiBaseURL+"/messages/text", bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("whatsapp: failed to build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("whatsapp: API returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
