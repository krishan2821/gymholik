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

## 9. Payments & Dues API Examples

Use an owner access token (`export ACCESS_TOKEN="ey..."`) or staff access token. Note that all monetary values are in **paise** (1 INR = 100 paise).

### 9.1 Get Payment Summary (OWNER Only)
Cached per gym for 30s. Automatically evicted on payment, reversal, or membership change.

```bash
# Period can be TODAY, WEEK, MONTH, ALL (default: MONTH)
curl -s -X GET "http://localhost:8080/api/payments/summary?period=TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Custom date range
curl -s -X GET "http://localhost:8080/api/payments/summary?from=2026-10-01&to=2026-10-15" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Payment summary fetched successfully",
  "data": {
    "collectedPaise": 500000,
    "count": 5,
    "byMode": {
      "CASH": { "paise": 200000, "percent": 40.0 },
      "UPI":  { "paise": 300000, "percent": 60.0 },
      "CARD": { "paise": 0,      "percent": 0.0 }
    },
    "previousPeriodPaise": 400000,
    "percentChange": 25.0,
    "pendingDuePaise": 150000,
    "pendingMembersCount": 3
  }
}
```

---

### 9.2 Record a Payment (OWNER or STAFF)
- `membershipId`: Optional when member has pending dues (defaults to `defaultMembershipId`, which is the oldest membership with an outstanding due). Must belong to the specified member and gym (returns 404 if mismatched).
- `amountPaise`: Positive amount in paise. Cannot exceed remaining due (`totalPaise - discountPaise - paidPaise`).
- `referenceNo`: Optional, max 40 chars (e.g. UPI txn id or last 4 digits of card).
- `paymentDate`: Optional business date (defaults to current server time in `Asia/Kolkata`). A past date up to 31 days back is allowed for OWNER only (stored at 12:00:00 IST, never midnight, and logs a `PAYMENT_BACKDATED` audit entry). Future dates are strictly rejected (400).
- Automatic single-source-of-truth recalculation via `MembershipLedgerService` executes in the same transaction.

```bash
curl -s -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "memberId":     "<member-mongo-id>",
    "membershipId": "<membership-mongo-id>",
    "amountPaise":  250000,
    "mode":         "UPI",
    "referenceNo":  "UPI-992384729182",
    "paymentDate":  "2026-10-18",
    "reason":       "Membership subscription partial payment"
  }' | jq .
```

---

### 9.2b Member Fees Breakdown for Collect Screen (OWNER or STAFF)
Returns full list of memberships with status (`UPCOMING`, `ACTIVE`, `EXPIRED`), total, discount, paid, due amounts, overall `dueTotalPaise`, and `defaultMembershipId` (oldest membership with due).

```bash
curl -s -X GET "http://localhost:8080/api/members/<member-id>/fees" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Member fees details fetched successfully",
  "data": {
    "memberId": "6acbe58a32c059781d3ec873",
    "dueTotalPaise": 400000,
    "defaultMembershipId": "6acbe58a32c059781d3ec874",
    "memberships": [
      {
        "membershipId": "6acbe58a32c059781d3ec874",
        "planName": "Quarterly Plan",
        "startDate": "2026-10-12",
        "expiryDate": "2027-01-10",
        "status": "ACTIVE",
        "totalPaise": 400000,
        "discountPaise": 0,
        "paidPaise": 0,
        "duePaise": 400000
      },
      {
        "membershipId": "6ace7f118bbe1a484954a159",
        "planName": "Quarterly Plan",
        "startDate": "2027-01-11",
        "expiryDate": "2027-04-11",
        "status": "UPCOMING",
        "totalPaise": 400000,
        "discountPaise": 0,
        "paidPaise": 400000,
        "duePaise": 0
      }
    ]
  }
}
```

---

### 9.3 List Grouped-Ready Payments (OWNER or STAFF)
- OWNER sees all gym payments.
- STAFF sees only payments collected by them in the last 7 days (with masked phone numbers).
- TRAINER is forbidden (403).

```bash
curl -s -X GET "http://localhost:8080/api/payments?period=MONTH&mode=UPI&search=Rahul&page=0&size=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Payments fetched successfully",
  "data": {
    "items": [
      {
        "id": "670c...",
        "receiptNo": "FIT-00001",
        "memberId": "670c...",
        "memberName": "Rahul Sharma",
        "memberCode": "FIT-M001",
        "planName": "Monthly Gold",
        "amountPaise": 250000,
        "mode": "UPI",
        "type": "PAYMENT",
        "paidAt": "2026-10-13T10:30:00Z",
        "collectedByName": "Priya Staff",
        "referenceNo": "UPI-992384729182"
      }
    ],
    "dayTotals": [
      {
        "date": "2026-10-13",
        "totalPaise": 250000
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  }
}
```

---

### 9.4 Get Payment Detail (OWNER or STAFF)
Includes membership payment snapshot and reversal tracking.

```bash
curl -s -X GET "http://localhost:8080/api/payments/<payment-id>" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Payment details fetched successfully",
  "data": {
    "id": "670c...",
    "receiptNo": "FIT-00001",
    "memberId": "670c...",
    "memberName": "Rahul Sharma",
    "memberCode": "FIT-M001",
    "planName": "Monthly Gold",
    "amountPaise": 250000,
    "mode": "UPI",
    "type": "PAYMENT",
    "paidAt": "2026-10-13T10:30:00Z",
    "collectedByName": "Priya Staff",
    "referenceNo": "UPI-992384729182",
    "membershipSummary": {
      "membershipId": "670c...",
      "planName": "Monthly Gold",
      "totalPaise": 500000,
      "discountPaise": 0,
      "paidPaise": 250000,
      "duePaise": 250000
    },
    "isReversed": false
  }
}
```

---

### 9.5 Reverse a Payment (OWNER Only)
Requires `reasonCode` (`WRONG_ENTRY`, `DUPLICATE`, `REFUND`, `OTHER`) and a note (5-300 characters). Cannot reverse a reversal; each payment can only be reversed once.

```bash
curl -s -X POST "http://localhost:8080/api/payments/<payment-id>/reverse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "reasonCode": "WRONG_ENTRY",
    "note": "Cashier entered incorrect amount"
  }' | jq .
```

---

### 9.6 Download Payment Receipt PDF (OWNER or STAFF)

```bash
curl -s -X GET "http://localhost:8080/api/payments/<payment-id>/receipt" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o receipt.pdf
```

---

### 9.7 List Dues (OWNER or STAFF)
- `filter` options: `ALL`, `OVERDUE`, `EXPIRING`, `PARTIAL` (default: `ALL`).
- Sorted by `duePaise` descending, then most overdue first.
- Returns `promisedDate` and `promiseBroken` flag when the date has passed and due is still positive.

```bash
curl -s -X GET "http://localhost:8080/api/dues?filter=OVERDUE&search=Rahul&page=0&size=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected response:**
```json
{
  "success": true,
  "message": "Dues fetched successfully",
  "data": {
    "items": [
      {
        "memberId": "670c...",
        "name": "Rahul Sharma",
        "memberCode": "FIT-M001",
        "phone": "+91 98*** ***11",
        "planName": "Monthly Gold",
        "duePaise": 250000,
        "totalPaise": 500000,
        "paidPaise": 250000,
        "expiryDate": "2026-10-10",
        "daysOverdue": 3,
        "lastPaymentAt": "2026-10-01T12:00:00Z",
        "promisedDate": "2026-10-12",
        "promiseBroken": true
      }
    ],
    "totalDuePaise": 250000,
    "count": 1,
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  }
}
```

---

### 9.8 Apply Membership Discount (OWNER Only)
Applies a controlled discount on an existing membership. The discount cannot make the due negative and cannot be greater than the current balance due. Evicts dashboard and summary caches.

```bash
curl -s -X POST "http://localhost:8080/api/memberships/<membership-id>/discount" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "discountPaise": 50000,
    "reason": "Promotional loyalty discount approved by management"
  }' | jq .
```

---

### 9.9 Set Promised Payment Date (OWNER or STAFF)
Sets the date by which the balance will be paid. Must be in the future and at most 90 days ahead.

```bash
curl -s -X PATCH "http://localhost:8080/api/memberships/<membership-id>/promised-date" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "promisedDate": "2026-11-01"
  }' | jq .
```

### 9.10 Gym Collection Info (OWNER and STAFF)
Get or update the gym's collection UPI ID and name for collecting fees. Completely separate from Gymholik platform subscription UPI.

```bash
# Get Gym Collection Info (OWNER, STAFF)
curl -s -X GET http://localhost:8080/api/gym/collection-info \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Update Gym Collection Info (OWNER only)
curl -s -X PUT http://localhost:8080/api/gym/collection-info \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "upiId": "gymfitness@okhdfcbank",
    "upiName": "Gym Fitness Collections"
  }' | jq .
```

---

### 9.11 Download Payment / Reversal Receipt PDF (OWNER or STAFF)
Generates OpenPDF receipt including gym details, member details (without phone), plan details, amounts in figures & Indian words, mode, reference number, balance due, staff first name, and footer.

```bash
curl -s -X GET "http://localhost:8080/api/payments/<payment-id>/receipt" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --output receipt.pdf
```

---

### 9.12 Day-Close Report and Submission (OWNER Only)
Reconcile cash drawer and payments for a business date.

```bash
# Get Day-Close Report
curl -s -X GET "http://localhost:8080/api/payments/day-close?date=2026-10-13" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Submit Day-Close (Lock drawer counts; immutable after submission)
curl -s -X POST http://localhost:8080/api/payments/day-close \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "date": "2026-10-13",
    "countedCashPaise": 300000,
    "note": "Drawer cash verified with evening shift handover"
  }' | jq .
```

---

## Run All Tests

```bash
cd backend && mvn clean test
```

