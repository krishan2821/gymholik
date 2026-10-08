# Gym Management API — cURL Examples

Base URL: `http://localhost:8080`

---

## 1. Register a Gym (starts 14-day trial)

```bash
curl -s -X POST http://localhost:8080/api/auth/register-gym \
  -H "Content-Type: application/json" \
  -d '{
    "gymName":     "FitZone Elite",
    "gymPhone":    "9876543210",
    "gymEmail":    "fitzone@example.com",
    "gymAddress":  "123 MG Road, Bengaluru",
    "ownerName":   "Rahul Sharma",
    "ownerPhone":  "9876543211",
    "password":    "Secure@1234"
  }' | jq .
```

**Expected response** (save `gymCode` and `gymId`):
```json
{
  "success": true,
  "message": "Gym registered. 14-day trial started.",
  "data": {
    "gymId":       "<mongo-id>",
    "gymName":     "FitZone Elite",
    "gymCode":     "FITZON1234",
    "ownerName":   "Rahul Sharma",
    "ownerPhone":  "9876543211",
    "trialEndsAt": "2026-10-21T10:30:00"
  }
}
```

---

## 2. Login as Owner

```bash
export GYM_CODE="FITZON1234"   # replace with value from step 1

curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone":    "9876543211",
    "password": "Secure@1234",
    "gymCode":  "'"$GYM_CODE"'"
  }' | jq .
```

**Expected response** (save `accessToken` and `refreshToken`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken":  "eyJhbGci...",
    "refreshToken": "550e8400-e29b-...",
    "tokenType":    "Bearer",
    "expiresIn":    1800,
    "userId":       "<mongo-id>",
    "gymId":        "<mongo-id>",
    "role":         "OWNER"
  }
}
```

---

## 3. Refresh Access Token

```bash
export REFRESH_TOKEN="550e8400-e29b-..."  # from step 2

curl -s -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "'"$REFRESH_TOKEN"'"}' | jq .
```

---

## 4. Create a Staff Account (OWNER only)

```bash
export ACCESS_TOKEN="eyJhbGci..."   # from step 2

curl -s -X POST http://localhost:8080/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name":     "Priya Trainer",
    "phone":    "9123456789",
    "password": "Staff@Pass1"
  }' | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Staff account created successfully"
}
```

---

## 5. Login as Staff

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone":    "9123456789",
    "password": "Staff@Pass1",
    "gymCode":  "FITZON1234"
  }' | jq .
```

---

## 6. SUPER_ADMIN Login (no gymCode)

```bash
# First, manually insert a SUPER_ADMIN user in MongoDB:
# db.users.insertOne({
#   name: "Super Admin", phone: "9000000000",
#   passwordHash: "<bcrypt of your password>",
#   role: "SUPER_ADMIN", active: true,
#   gymId: null, createdAt: new Date()
# })

curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone":    "9000000000",
    "password": "SuperAdmin@1"
  }' | jq .
```

---

## 7. Trigger Lockout (5 bad passwords)

```bash
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "phone":    "9876543211",
      "password": "WRONGPASSWORD",
      "gymCode":  "FITZON1234"
    }' | jq .message
done
# On attempt 5: account locked
# On attempt 6: ACCOUNT_LOCKED error immediately
```

---

## 8. Validation Error Example

```bash
curl -s -X POST http://localhost:8080/api/auth/register-gym \
  -H "Content-Type: application/json" \
  -d '{
    "gymName":    "F",
    "gymPhone":   "12345",
    "ownerPhone": "abc"
  }' | jq .
```

**Expected:**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "gymName":    "Gym name must be 2–100 characters",
    "gymPhone":   "Enter a valid 10-digit Indian mobile number",
    "ownerName":  "Owner name is required",
    "ownerPhone": "Enter a valid 10-digit Indian mobile number",
    "password":   "Password is required"
  }
}
```

---

## 9. Swagger UI

Open in browser: http://localhost:8080/swagger-ui.html

- Click **Authorize** (top right) → paste the `accessToken` as `Bearer <token>`
- All endpoints are interactive

---

## Local Development (without Docker)

```bash
# 1. Start MongoDB only
cd backend && docker-compose up -d mongodb

# 2. Run the Spring Boot app
mvn spring-boot:run

# App starts at http://localhost:8080
```

## Full Docker Compose

```bash
# 1. Build JAR first
cd backend && mvn package -DskipTests

# 2. Start everything
docker-compose up -d

# 3. View logs
docker-compose logs -f gymapp

# 4. Stop
docker-compose down
```

## Run Unit Tests

```bash
cd backend && mvn test
```
