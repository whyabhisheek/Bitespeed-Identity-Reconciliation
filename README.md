# Bitespeed Backend Task - Identity Reconciliation

This project implements the `/identify` endpoint from the Bitespeed backend task using:
- Node.js + TypeScript
- Express
- SQLite (`sqlite3` package)

## Setup

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3000` by default.

## Endpoint

`POST /identify`

`GET /contacts`

`GET /docs`

Request body:

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Response shape:

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

## Scripts

- `npm run dev` - run server in watch mode
- `npm run build` - compile TypeScript
- `npm start` - run compiled server

## Deployment (Render)

1. Push this project to a GitHub repository.
2. In Render, create a new `Web Service` and connect your GitHub repo.
3. Use these settings:
- Runtime: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Auto-Deploy: `Yes`
4. Deploy and copy your live base URL.

### Live Endpoint (Add after deploy)

- Base URL: `https://bitespeed-identity-reconciliation-1-ghse.onrender.com`
- Identify Endpoint: `https://bitespeed-identity-reconciliation-1-ghse.onrender.com/identify`
- Docs: `https://bitespeed-identity-reconciliation-1-ghse.onrender.com/docs`
- Contacts: `https://bitespeed-identity-reconciliation-1-ghse.onrender.com/contacts`

### Verify after deploy

```bash
curl https://bitespeed-identity-reconciliation-1-ghse.onrender.com/
curl https://bitespeed-identity-reconciliation-1-ghse.onrender.com/docs
curl -X POST https://bitespeed-identity-reconciliation-1-ghse.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"mcfly@hillvalley.edu\",\"phoneNumber\":\"123456\"}"
```

## Notes

- `email` is normalized to lowercase and trimmed.
- `phoneNumber` is normalized to string.
- If request links multiple primaries, the oldest primary remains primary and the others are converted to secondary.
- A new secondary is created only when incoming request introduces new email and/or phone data.
- SQLite file is created automatically at `identity.db` on first run.
