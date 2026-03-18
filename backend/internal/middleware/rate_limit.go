package middleware

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// IPRateLimiter tracks the rate limiter for each IP address.
type IPRateLimiter struct {
	ips map[string]*rate.Limiter
	mu  *sync.RWMutex
	r   rate.Limit
	b   int
}

// NewIPRateLimiter creates a new rate limiter for IP addresses.
func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	return &IPRateLimiter{
		ips: make(map[string]*rate.Limiter),
		mu:  &sync.RWMutex{},
		r:   r,
		b:   b,
	}
}

// GetLimiter returns the rate limiter for the provided IP address.
func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.RLock()
	limiter, exists := i.ips[ip]
	i.mu.RUnlock()

	if !exists {
		i.mu.Lock()
		limiter = rate.NewLimiter(i.r, i.b)
		i.ips[ip] = limiter
		i.mu.Unlock()
	}

	return limiter
}

// RateLimitMiddleware applies rate limiting to the request.
func RateLimitMiddleware(limiter *IPRateLimiter) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			// Extract real IP if behind a proxy
			realIP := r.Header.Get("X-Real-IP")
			if realIP != "" {
				ip = realIP
			}
			forwarded := r.Header.Get("X-Forwarded-For")
			if forwarded != "" {
				ip = forwarded
			}

			if !limiter.GetLimiter(ip).Allow() {
				http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
