package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const whapiBaseURL = "https://gate.whapi.cloud"

// WhatsAppService sends messages via the Whapi.Cloud REST API.
type WhatsAppService struct {
	httpClient *http.Client
}

// NewWhatsAppService creates a WhatsAppService.
func NewWhatsAppService() *WhatsAppService {
	return &WhatsAppService{
		httpClient: &http.Client{},
	}
}

// sendTextMessageRequest is the Whapi POST /messages/text body.
type sendTextMessageRequest struct {
	To   string `json:"to"`
	Body string `json:"body"`
}

// SendGroupMessage sends a plain-text message to a WhatsApp group using the provided token.
// groupID is the Whapi chat ID, e.g. "120363xxxxxx@g.us".
func (s *WhatsAppService) SendGroupMessage(token, groupID, body string) error {
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
	req.Header.Set("Authorization", "Bearer "+token)

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
