# Magent (AI Agent Platform)

A no-code AI agent platform enabling users to create, customize, and deploy voice/text agents for customer support, workflow automation, and personal assistance.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript + Vite
- **Database**: Supabase (PostgreSQL)
- **Vector Support**: pgvector for RAG
- **APIs**: 
  - Brave Search
  - Gladia (STT)
  - ElevenLabs (TTS)

## Prerequisites

- Node.js >= 18
- PostgreSQL with pgvector extension
- Redis (optional)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/magent.git
   cd magent
   ```

2. Install dependencies:
   ```bash
   npm install
   cd src/frontend && npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Start development servers:
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend
   
   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

## Development

- Backend runs on: http://localhost:3000
- Frontend runs on: http://localhost:5173

## Project Structure

```
magent/
├── src/
│   ├── backend/
│   │   ├── modules/
│   │   │   ├── agent/
│   │   │   ├── rag/
│   │   │   └── tools/
│   │   └── server.ts
│   └── frontend/
│       ├── components/
│       └── ...
├── migrations/
└── ...
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT 