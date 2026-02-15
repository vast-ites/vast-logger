package auth

import (
    "os"
    "time"
    "math/rand"
    
    "github.com/golang-jwt/jwt/v5"
    "github.com/datavast/datavast/server/storage"
)

var JwtSecret = []byte("super-secret-jwt-key-change-me-in-prod")

type Claims struct {
    Username string   `json:"username"`
    Role     string   `json:"role"`
    Allowed  []string `json:"allowed"` // List of allowed hosts ("*" for all)
    jwt.RegisteredClaims
}

type AuthParams struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type AuthManager struct {
    Config *storage.ConfigStore
}

func NewAuthManager(cfg *storage.ConfigStore) *AuthManager {
    mgr := &AuthManager{Config: cfg}
    // Ensure admin password exists
    c := cfg.Get()
    
    // Priority 1: Use environment variable if set
    if envPass := os.Getenv("ADMIN_PASSWORD"); envPass != "" {
        if c.AdminPassword != envPass {
            c.AdminPassword = envPass
            cfg.Save(c)
            println("\n [SECURITY] ✅ Admin password loaded from .env file")
        }
    } else if c.AdminPassword == "" {
        // Priority 2: Generate random password if not in env or config
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

func (m *AuthManager) ValidateUser(u, p string) (string, []string, bool) {
    cfg := m.Config.Get()

    // 1. Check Admin
    if u == "admin" {
        if cfg.AdminPassword == p {
            return "admin", []string{"*"}, true
        }
        return "", nil, false
    }

    // 2. Check Users
    for _, user := range cfg.Users {
        if user.Username == u && user.Password == p {
            // Calculate Allowed Hosts
            allowed := []string{}
            allowed = append(allowed, user.AllowedHosts...)
            
            // Resolve Groups
            for _, gID := range user.Groups {
                for _, grp := range cfg.Groups {
                    if grp.ID == gID {
                        allowed = append(allowed, grp.Hosts...)
                    }
                }
            }
            
            return user.Role, allowed, true
        }
    }

    return "", nil, false
}

func (m *AuthManager) GenerateToken(username, role string, allowed []string) (string, error) {
    expirationTime := time.Now().Add(24 * time.Hour)
    claims := &Claims{
        Username: username,
        Role:     role,
        Allowed:  allowed,
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
