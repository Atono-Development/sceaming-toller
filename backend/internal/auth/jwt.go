package auth

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/jwks"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

var (
	jwtValidator *validator.Validator
)

// InitAuth0 initializes the Auth0 JWKS token validator
func InitAuth0() {
	auth0Domain := os.Getenv("AUTH0_DOMAIN")
	if auth0Domain == "" {
		log.Println("AUTH0_DOMAIN is not set, API auth will fail")
		return
	}

	// Ensure domain has https:// prefix
	if !strings.HasPrefix(auth0Domain, "http") {
		auth0Domain = "https://" + auth0Domain
	}
	
	issuerURL, err := url.Parse(auth0Domain + "/")
	if err != nil {
		log.Fatalf("Failed to parse the issuer url: %v", err)
	}

	provider := jwks.NewCachingProvider(issuerURL, 5*time.Minute)

	// We use the first allowed origin to determine audience if AUTH0_AUDIENCE isn't set
	audience := os.Getenv("AUTH0_AUDIENCE")
	if audience == "" {
		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins != "" {
			firstOrigin := strings.Split(allowedOrigins, ",")[0]
			audience = strings.TrimRight(firstOrigin, "/") + "/api"
		} else {
			audience = "http://localhost:5173/api" // fallback if nothing is set
		}
	}

	jwtValidator, err = validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL.String(),
		[]string{audience},
		validator.WithCustomClaims(
			func() validator.CustomClaims {
				return &CustomClaims{}
			},
		),
		validator.WithAllowedClockSkew(time.Minute),
	)
	if err != nil {
		log.Fatalf("Failed to set up the jwt validator: %v", err)
	}
}

// CustomClaims contains custom data we want from the token.
type CustomClaims struct {
	Scope string `json:"scope"`
}

// Validate does nothing here, but we need it to satisfy validator.CustomClaims interface.
func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

// CheckJWT returns a fully configured jwtmiddleware handler that will validate tokens.
func CheckJWT() *jwtmiddleware.JWTMiddleware {
	return jwtmiddleware.New(
		jwtValidator.ValidateToken,
		jwtmiddleware.WithErrorHandler(func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("Encountered error while validating JWT: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"message":"Failed to validate JWT."}`))
		}),
	)
}

// Ensure Token func handles the token extraction from context
func GetAuth0Sub(ctx context.Context) (string, error) {
	token, ok := ctx.Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	if !ok {
		return "", errors.New("missing or invalid token in context")
	}
	return token.RegisteredClaims.Subject, nil
}
