package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

// getEncryptionKey retrieves and decodes the 32-byte master key from environment variables.
func getEncryptionKey() ([]byte, error) {
	keyStr := os.Getenv("ENCRYPTION_KEY")
	if keyStr == "" {
		return nil, errors.New("ENCRYPTION_KEY environment variable not set")
	}
	key, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil {
		return nil, fmt.Errorf("invalid ENCRYPTION_KEY: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("invalid ENCRYPTION_KEY length: expected 32 bytes, got %d", len(key))
	}
	return key, nil
}

// Encrypt encrypts a plaintext string using AES-256-GCM.
func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a base64 encoded ciphertext string using AES-256-GCM.
func Decrypt(ciphertextStr string) (string, error) {
	if ciphertextStr == "" {
		return "", nil
	}
	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextStr)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
