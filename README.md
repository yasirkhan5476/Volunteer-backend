# Volunteer Platform — Backend API

A production-ready **Node.js / Express** backend following Clean Architecture principles.

## Stack
- **Runtime**: Node.js 20+
- **Framework**: Express 4.x
- **ORM**: Prisma (PostgreSQL)
- **Validation**: Zod
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Cache / Queue**: ioredis + BullMQ
- **Email**: Nodemailer (SMTP)
- **PDF**: PDFKit
- **Storage**: Local filesystem (uploads/ directory)
- **Payments**: SafePay, JazzCash, EasyPaisa

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env with your values

# 3. Generate ECDSA keys for Passport signing
mkdir -p keys
openssl ecparam -genkey -name prime256v1 -noout -out keys/passport_private.pem
openssl ec -in keys/passport_private.pem -pubout -out keys/passport_public.pem

# 4. Start infrastructure (Docker)
docker-compose up -d postgres redis

# 5. Run DB migrations
npm run migrate

# 6. Seed the database
npm run seed

# 7. Start development server
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | — | Health check |
| POST | `/api/v1/auth/register` | — | Register account |
| POST | `/api/v1/auth/login` | — | Login |
| GET | `/api/v1/auth/me` | JWT | Get profile |
| GET | `/api/v1/admin/approvals` | SUPER_ADMIN | List pending organizer applications |
| PATCH | `/api/v1/admin/organizers/:id/status` | SUPER_ADMIN | Approve or reject organizer application |
| PATCH | `/api/v1/auth/profile` | JWT | Update profile |
| GET | `/api/v1/events` | — | List events |
| GET | `/api/v1/events/:id` | — | Get event |
| POST | `/api/v1/events` | ORGANIZER/ADMIN | Create event |
| PATCH | `/api/v1/events/:id` | ORGANIZER/ADMIN | Update event |
| DELETE | `/api/v1/events/:id` | ADMIN | Deactivate event |
| POST | `/api/v1/attendance/check-in` | JWT | Check in |
| POST | `/api/v1/attendance/check-out` | JWT | Check out |
| GET | `/api/v1/attendance/my` | JWT | My attendance |
| POST | `/api/v1/donations` | JWT | Initiate donation |
| GET | `/api/v1/donations/my` | JWT | My donations |
| POST | `/api/v1/webhooks/safepay` | — | SafePay callback |
| POST | `/api/v1/webhooks/jazzcash` | — | JazzCash callback |
| POST | `/api/v1/webhooks/easypaisa` | — | EasyPaisa callback |
| POST | `/api/v1/passport/issue` | VOLUNTEER/ADMIN | Issue passport |
| GET | `/api/v1/passport/verify/:id` | — | Verify passport |
| GET | `/api/v1/passport/my` | JWT | My passports |

### SafePay checkout

Set `SAFE_PAY_API_KEY` and `SAFE_PAY_BASE_URL` from the SafePay merchant
dashboard. Donations use PKR. SafePay must be able to reach
`/api/v1/webhooks/safepay` when sending payment status updates.

## Roles

| Role | Permissions |
|------|-------------|
| `VOLUNTEER` | Check in/out, issue own passport, donate |
| `ORGANIZER` | All VOLUNTEER + create/manage events |
| `ADMIN` | All permissions, manage all users |
| `DONOR` | Donate to events |

## Scripts

```bash
npm run dev          # Start with nodemon
npm start            # Start production
npm test             # Run Jest tests
npm run test:coverage # Coverage report
npm run lint         # ESLint
npm run migrate      # Create & run migration
npm run seed         # Seed database
npm run studio       # Prisma Studio UI
npm run create-admin -- admin@example.com "StrongPassword123" First Last # Bootstrap SUPER_ADMIN
```

Public organizer applications are stored as `ORGANIZER_PENDING`. They cannot
publish events or initiate donations until a `SUPER_ADMIN` approves them from
`/admin/approvals`. Apply the RBAC migration with `npx prisma migrate deploy`
and regenerate the client with `npx prisma generate`.

Attendance records that are still `CHECKED_IN` when an event's `endTime` passes
are automatically changed to `AUTO_CLOSED` every minute. Their hours are
calculated from check-in time to the event end time and added to the volunteer
profile.

## Docker

```bash
docker-compose up     # Start all services
docker-compose down   # Stop all services
```