package auth

import (
    "time"
    "math/rand"
    
    "github.com/golang-jwt/jwt/v5"
    "github.com/datavast/datavast/server/storage"
)

var JwtSecret = []byte("super-secret-jwt-key-change-me-in-prod")

type Claims struct {
    Role string `json:"role"`
    jwt.RegisteredClaims
}

type AuthManager struct {
    Config *storage.ConfigStore
}

func NewAuthManager(cfg *storage.ConfigStore) *AuthManager {
    mgr := &AuthManager{Config: cfg}
    // Ensure admin password exists
    c := cfg.Get()
    if c.AdminPassword == "" {
        // Generate random password
        newPass := GenerateRandomString(12)
        c.AdminPassword = newPass
        cfg.Save(c)
        // Print to console for user to see
        println("\n\n [SECURITY] ---------------------------------------------------")
        println(" [SECURITY] Admin Password Generated: " + newPass)
        println(" [SECURITY] Please save this password to log in.")
        println(" [SECURITY] ---------------------------------------------------\n")
    }
    return mgr
}

func (m *AuthManager) ValidatePassword(pass string) bool {
    // In real world, use bcrypt. For now, simple string compare for 'Zero Config'
    return m.Config.Get().AdminPassword == pass
}

func (m *AuthManager) GenerateToken() (string, error) {
    expirationTime := time.Now().Add(24 * time.Hour)
    claims := &Claims{
        Role: "admin",
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(expirationTime),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(JwtSecret)
}

func GenerateRandomString(n int) string {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    b := make([]byte, n)
    for i := range b {
        b[i] = letters[rand.Intn(len(letters))]
    }
    return string(b)
}
