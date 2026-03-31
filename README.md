# DC Concierge — Seller Portal

A dual-portal system for the Darius Cincys real estate team to manage seller client communications, showing activity, marketing efforts, and property photos.

## Architecture

**Admin Portal** (Stefan & Darius)  
- Warm Confidence theme (dark, charcoal + gold)
- Property management for up to 30 active listings
- Manual activity entry + ShowingTime CSV import
- Alfred auto-drafts client-facing feedback from raw notes
- Approval queue → Push to client portal
- Drag-and-drop photo upload per listing
- Marketing effort tracking
- Client account + property access management

**Client Portal** (Sellers)  
- Clean luxury design (light, white + gold accents)
- Login: LastName+StreetNumber / custom password
- Property dashboard with donut chart (activity by source)
- Weekly trend area chart
- Showing history with brokerage + approved feedback
- Open house / broker open recaps
- Marketing efforts section
- Photo gallery with lightbox
- Multi-property switcher if applicable
- Fully responsive (mobile + desktop)

## Tech Stack

- **Frontend**: React 18 + Vite, Recharts, Lucide icons
- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL
- **Auth**: JWT tokens, bcrypt password hashing
- **AI**: Anthropic Claude API (Alfred feedback drafting)
- **Deploy**: Railway (Docker)

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### Setup

1. **Database**:
```bash
createdb seller_portal
```

2. **Backend**:
```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and Anthropic API key
pip install -r requirements.txt
python main.py
```
Backend runs on http://localhost:8000

3. **Frontend**:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5175 (proxies API to :8000)

### Default Admin Accounts
- Username: `stefan` / Password: `admin123`
- Username: `darius` / Password: `admin123`

**Change these passwords in production!**

## Railway Deployment

1. Create a new project on Railway
2. Add a PostgreSQL service
3. Add a new service from this GitHub repo
4. Set environment variables:
   - `DATABASE_URL` — Railway provides this from PostgreSQL
   - `SECRET_KEY` — Generate a random string
   - `ANTHROPIC_API_KEY` — Your Anthropic API key
5. Railway will auto-build using the Dockerfile

## Daily Workflow

### Morning Routine
1. Export previous day's showings from ShowingTime as CSV
2. Log into Admin Portal → go to the property
3. Click "Import CSV" and upload the file
4. Alfred auto-drafts client-facing feedback for each showing
5. Review each draft in the approval queue, edit if needed
6. Click "Approve" then "Push to Client" (or batch push)

### Adding Activity Manually
1. Admin Portal → Property → Activities → "Add Activity"
2. Select type (Showing, Open House, Broker Open, Agent Preview)
3. Enter date, brokerage, visitor count, raw feedback
4. Alfred drafts a polished version
5. Review, approve, push

### Onboarding a New Client
1. Send client to the signup page: `yoursite.com/signup`
2. They create account with username: `LastName` + `StreetNumber` (e.g., `smith1234`)
3. In Admin Portal → Clients → find the new client
4. Click "Grant Access" → select their property
5. Client can now log in and see their dashboard

## CSV Format (ShowingTime Import)

The importer is flexible and recognizes these column names:

| Column | Alternatives |
|--------|-------------|
| Date | `Showing Date`, `date` |
| Brokerage | `Buying Office`, `brokerage` |
| Feedback | `Agent Feedback`, `Comments`, `feedback` |
| Type | `type` (defaults to "showing") |

Date formats supported: `MM/DD/YYYY`, `YYYY-MM-DD`, `MM/DD/YY`, `MM-DD-YYYY`

## Activity Types & Donut Chart

The donut chart on the client dashboard dynamically shows only categories that have data:
- **Private Showing** — standard buyer showings
- **Open House** — public open houses (tracks visitor count)
- **Broker Open** — broker/agent open events
- **Agent Preview** — private agent previews

Categories with zero entries are hidden automatically.

## Future Enhancements (Planned)
- Offer tracking and status updates
- Client email notifications (opt-in)
- ShowingTime API integration (if available via MLS)
- Alfred Feedback Hotline integration (auto-feed from voicemail transcripts)
