# Gym Management API — cURL Examples (OTP Auth & Gym Registration)

Base URL: `http://localhost:8080`

Required environment variables when starting the backend:
```bash
export OTP_PEPPER="your-long-random-hmac-sha256-pepper-secret"
export OTP_DEV_FIXED_CODE="123456"        # optional, dev profile only
export SUPER_ADMIN_PHONE="9000000000"     # optional, seeds SUPER_ADMIN at startup if none exists
```

---

## 1. Send OTP (New or Existing Phone Number)

```bash
curl -s -X POST http://localhost:8080/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543211"
  }' | jq .
```

**Expected response** (identical for registered and unregistered numbers):
```json
{
  "success": true,
  "message": "OTP sent",
  "data": {
    "resendAfterSeconds": 30,
    "expiresInSeconds": 300
  }
}
```

---

## 2. Verify OTP (New User → Issues Single-Use `registrationToken`)

```bash
curl -s -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543211",
    "otp":   "123456"
  }' | jq .
```

**Expected response** (save `registrationToken`):
```json
{
  "success": true,
  "message": "Verified",
  "data": {
    "isNewUser": true,
    "registrationToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

---

## 3. Complete Gym-Owner Registration (14-Day Trial + Default Plans & Trainer Types)

Requires the `registrationToken` (`scope = REGISTER`) from Step 2. The owner's phone number is taken strictly from the token, never from the request body. The token is single-use and has a 30-minute validity.

```bash
export REG_TOKEN="eyJhbGciOiJIUzI1NiJ9..."   # from step 2

curl -s -X POST http://localhost:8080/api/auth/complete-registration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REG_TOKEN" \
  -d '{
    "gymName":       "FitZone Elite",
    "gymType":       "COMMERCIAL",
    "ownerName":     "Rahul Sharma",
    "email":         "rahul@fitzone.in",
    "legalIdType":   "GSTIN",
    "legalIdNumber": "27AAAAA0000A1Z5",
    "address": {
      "line1":    "Shop 4, Crystal Plaza, Link Road",
      "line2":    "Andheri West",
      "state":    "Maharashtra",
      "district": "Mumbai Suburban",
      "pincode":  "400053"
    },
    "acceptedTerms": true,
    "termsVersion":  "1.0"
  }' | jq .
```

**Expected response** (save `accessToken` and `refreshToken`):
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "isNewUser": false,
    "accessToken":  "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id":      "<user-mongo-id>",
      "name":    "Rahul Sharma",
      "role":    "OWNER",
      "gymId":   "<gym-mongo-id>",
      "gymName": "FitZone Elite"
    },
    "gym": {
      "id":      "<gym-mongo-id>",
      "name":    "FitZone Elite",
      "gymCode": "H97KMNP2",
      "gymType": "COMMERCIAL"
    }
  }
}
```

---

## 4. Login as Existing User (OWNER / STAFF / TRAINER / SUPER_ADMIN)

1. Request OTP:
```bash
curl -s -X POST http://localhost:8080/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543211"}' | jq .
```

2. Verify OTP (wait 30s if reusing the same number from Step 1):
```bash
curl -s -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543211",
    "otp":   "123456"
  }' | jq .
```

**Expected response**:
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "isNewUser": false,
    "accessToken":  "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "user": {
      "id":      "<user-mongo-id>",
      "name":    "Rahul Sharma",
      "role":    "OWNER",
      "gymId":   "<gym-mongo-id>",
      "gymName": "FitZone Elite"
    }
  }
}
```

---

## 5. Refresh Access Token (Rotation)

```bash
export REFRESH_TOKEN="7c9e6679-7425-40de-944b-e07fc1f90ae7"

curl -s -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "'"$REFRESH_TOKEN"'"}' | jq .
```

---

## 6. Create a Staff Account (OWNER Only — No Password Required)

```bash
export ACCESS_TOKEN="eyJhbGciOiJIUzI1NiJ9..."

curl -s -X POST http://localhost:8080/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name":  "Priya Staff",
    "phone": "9123456789"
  }' | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Staff account created successfully"
}
```
Staff members log in using the same `/api/auth/send-otp` and `/api/auth/verify-otp` endpoints with their registered phone number.

---

## 7. SUPER_ADMIN Login (Seeded from `SUPER_ADMIN_PHONE`)

When `SUPER_ADMIN_PHONE=9000000000` is set at startup and no `SUPER_ADMIN` exists yet, the application seeds the `SUPER_ADMIN` user automatically. The super admin logs in through the same OTP flow:

```bash
curl -s -X POST http://localhost:8080/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9000000000"}' | jq .

curl -s -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9000000000", "otp": "123456"}' | jq .
```

---

## 8. Swagger UI

Open in browser: `http://localhost:8080/swagger-ui.html`

- Click **Authorize** (top right) → paste the `accessToken` (or `registrationToken` when testing `/api/auth/complete-registration`)
- All endpoints are interactive

---

## Run All Tests

```bash
cd backend && mvn clean test
```
