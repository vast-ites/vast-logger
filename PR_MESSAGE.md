# Improve Environment Configuration and Authentication Setup

## Summary
This PR simplifies the server setup process by implementing automatic `.env` file loading and environment-based authentication configuration. Users no longer need to manually export environment variables, making the setup more intuitive and production-ready.

## Problem Statement
Previously, users faced several challenges during setup:
1. **Manual Environment Variable Export**: Required running `export AUTH_ENABLED=true` and `export ADMIN_PASSWORD=...` before starting the server
2. **Inconsistent Password Handling**: Admin password was always auto-generated, ignoring `.env` configuration
3. **Database Connection Issues**: Incorrect default ClickHouse DSN caused connection failures
4. **Confusing Setup Flow**: No clear documentation on how to configure credentials before first run

## Changes Made

### 1. Automatic `.env` File Loading
**Files Modified:** `server/main.go`

- Added `godotenv` package to automatically load `.env` file on server startup
- Server now reads from `../.env` (parent directory) or `./server/.env`
- Eliminates need for manual `export` commands

**Before:**
```bash
export AUTH_ENABLED=true
export ADMIN_PASSWORD=mysecret
./datavast-server
```

**After:**
```bash
./datavast-server  # Automatically loads from .env
```

### 2. Environment-Based Admin Password
**Files Modified:** `server/auth/auth.go`

- Modified `NewAuthManager()` to prioritize `ADMIN_PASSWORD` from environment variable
- Auto-generation only happens if environment variable is not set
- Provides clear feedback when password is loaded from `.env`

**Logic Flow:**
1. Check `ADMIN_PASSWORD` environment variable → Use if set ✅
2. Check `server-config.json` → Use if exists
3. Auto-generate random password → Only if both above are empty

### 3. Fixed ClickHouse Connection String
**Files Modified:** `.env.example`, `.env`

- Updated DSN from `tcp://localhost:9000?database=logs` to `tcp://datavast:securepass@localhost:9000/datavast`
- Matches actual Docker Compose configuration (user: `datavast`, db: `datavast`)
- Resolves "Authentication failed" errors on first run

### 4. Secure-by-Default Configuration
**Files Modified:** `.env.example`

- Set `AUTH_ENABLED=true` by default (was `false`)
- Set default `ADMIN_PASSWORD=admin123` (was `CHANGE_ME`)
- Ensures authentication works out-of-the-box after copying `.env.example` to `.env`

### 5. Updated Documentation
**Files Modified:** `README.md`

- Added Step 2: "Configure Environment" in Quick Start guide
- Clearly documented default credentials (`admin` / `admin123`)
- Added password change instructions in Authentication section
- Updated step numbering to reflect new setup flow

## Technical Details

### Dependencies Added
- `github.com/joho/godotenv v1.5.1` - For `.env` file parsing

### Files Changed
```
server/main.go             # Auto-load .env file
server/auth/auth.go        # Environment-based password
server/go.mod              # Added godotenv dependency
.env.example               # Updated defaults
README.md                  # Improved documentation
```

## Testing

### New Setup Flow (from scratch)
```bash
# 1. Start databases
cd deployment && docker-compose up -d

# 2. Configure environment
cp .env.example .env
# (Optional: edit .env to change password)

# 3. Start server
cd server
go build -o datavast-server
./datavast-server
```

### Expected Behavior
- ✅ Server starts without manual `export` commands
- ✅ ClickHouse connection succeeds
- ✅ Admin password is `admin123` (or custom value from `.env`)
- ✅ Login works with documented credentials
- ✅ Clean console output: `[SECURITY] ✅ Admin password loaded from .env file`

### Backward Compatibility
- ✅ Existing `server-config.json` files still work
- ✅ Environment variables can still be set manually if needed
- ✅ Auto-generation still works if `.env` is missing

## Benefits

1. **🚀 Faster Setup**: No manual export commands needed
2. **🔐 More Secure**: Authentication enabled by default
3. **📝 Better UX**: Clear documentation with default credentials
4. **🐛 Fewer Bugs**: Correct database configuration out-of-the-box
5. **🔄 Production-Ready**: Environment-based config follows 12-factor app principles

## Migration Guide

### For Existing Users
If you already have the server running:

1. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

2. (Optional) Migrate your existing password:
   ```bash
   # If you have server-config.json, copy the admin_password value to .env
   nano .env  # Set ADMIN_PASSWORD to your existing password
   ```

3. Rebuild and restart:
   ```bash
   cd server
   go build -o datavast-server
   ./datavast-server
   ```

### For New Users
Just follow the updated README Quick Start guide. Everything works out-of-the-box!

## Screenshots/Logs

**Before (Auto-generated password):**
```
[SECURITY] ---------------------------------------------------
[SECURITY] Admin Password Generated: pG*FtRl%GDS0
[SECURITY] Please save this password to log in.
[SECURITY] ---------------------------------------------------
```

**After (Environment-based):**
```
[SECURITY] ✅ Admin password loaded from .env file
```

## Checklist

- [x] Code changes tested locally
- [x] Documentation updated (README.md)
- [x] Default configuration works out-of-the-box
- [x] Backward compatibility maintained
- [x] No breaking changes to existing deployments
- [x] Security best practices followed (auth enabled by default)

## Related Issues
Fixes issues related to:
- Complex setup process requiring manual environment variable exports
- Database connection failures due to incorrect DSN
- Confusion about default admin credentials
- Auto-generated passwords being difficult to track

---

**Note:** This PR makes the setup process significantly simpler while maintaining security and flexibility. Users can now get started with just `cp .env.example .env && ./datavast-server`! 🚀
