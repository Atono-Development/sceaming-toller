package services

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v2"
)

type EmailService struct {
	client  *resend.Client
	fromEmail string
	appURL    string
}

// NewEmailService creates a new email service instance
func NewEmailService() (*EmailService, error) {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("RESEND_API_KEY environment variable is not set")
	}

	fromEmail := os.Getenv("FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "noreply@yourdomain.com" // Default fallback
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173" // Default to local development
	}

	client := resend.NewClient(apiKey)

	return &EmailService{
		client:    client,
		fromEmail: fromEmail,
		appURL:    appURL,
	}, nil
}

// SendInvitationEmail sends an invitation email to a new team member
func (s *EmailService) SendInvitationEmail(toEmail, teamName, inviterName, token string) error {
	invitationURL := fmt.Sprintf("%s/accept-invitation/%s", s.appURL, token)

	htmlContent := s.buildInvitationHTML(teamName, inviterName, invitationURL)
	textContent := s.buildInvitationText(teamName, inviterName, invitationURL)

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{toEmail},
		Subject: fmt.Sprintf("You've been invited to join %s", teamName),
		Html:    htmlContent,
		Text:    textContent,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	return nil
}

// buildInvitationHTML creates the HTML email template
func (s *EmailService) buildInvitationHTML(teamName, inviterName, invitationURL string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Team Invitation</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                                Hi there! 👋
                            </p>
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                                <strong>%s</strong> has invited you to join the team <strong>%s</strong>.
                            </p>
                            <p style="margin: 0 0 30px; font-size: 16px; line-height: 24px; color: #666666;">
                                Click the button below to accept the invitation and join the team. This invitation will expire in 7 days.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%%; border-collapse: collapse;">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="%s" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                            Accept Invitation
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0; font-size: 14px; line-height: 20px; color: #999999;">
                                Or copy and paste this link into your browser:<br>
                                <a href="%s" style="color: #667eea; word-break: break-all;">%s</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999;">
                                If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, inviterName, teamName, invitationURL, invitationURL, invitationURL)
}

// buildInvitationText creates the plain text email template
func (s *EmailService) buildInvitationText(teamName, inviterName, invitationURL string) string {
	return fmt.Sprintf(`
Team Invitation

Hi there!

%s has invited you to join the team %s.

Click the link below to accept the invitation and join the team. This invitation will expire in 7 days.

%s

If you didn't expect this invitation, you can safely ignore this email.
`, inviterName, teamName, invitationURL)
}
