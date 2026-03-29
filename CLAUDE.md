# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack on localhost:3000
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Vitest (jsdom environment)
npm run db:reset       # Drop and recreate the SQLite database
```

To run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

## Architecture

**UIGen** is an AI-powered React component generator. Users describe components in a chat interface; Claude generates the code using tool calls, which populates a virtual file system rendered as a live preview.

### Request Flow

1. User sends a message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. Server calls Claude (or MockLanguageModel if no `ANTHROPIC_API_KEY`) via the Vercel AI SDK
3. Claude's tool calls (`str_replace_editor`, `file_manager`) mutate the **VirtualFileSystem** (`src/lib/file-system.ts`) — an in-memory tree, never written to disk
4. Streamed response (text + tool call results) is returned to the client
5. Client updates FileSystem context → triggers re-render of CodeEditor and PreviewFrame

### Three-Panel UI (`src/app/main-content.tsx`)

- **Left:** Chat (ChatInterface → MessageList + MessageInput)
- **Right — Preview tab:** `PreviewFrame` renders `App.jsx` in an iframe using Babel standalone + ReactDOM (no server involvement)
- **Right — Code tab:** `FileTree` (file navigation) + Monaco `CodeEditor`

### Authentication

- JWT sessions via `jose` stored in HTTP-only cookies (`src/lib/auth.ts`)
- Authenticated users get projects persisted to SQLite via Prisma (messages + serialized VirtualFileSystem stored as JSON in `Project.data`)
- Anonymous users work entirely in-memory; `anon-work-tracker.ts` optionally tracks their session

### AI Provider (`src/lib/provider.ts`)

Switches between `@ai-sdk/anthropic` and `MockLanguageModel` based on `ANTHROPIC_API_KEY`. The mock provider generates a static demo component after a short delay (useful for development without an API key).

### Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Chat API — orchestrates Claude tool use (up to 40 steps) |
| `src/lib/prompts/generation.tsx` | System prompt sent to Claude |
| `src/lib/file-system.ts` | VirtualFileSystem class (in-memory, serializable) |
| `src/lib/tools/str-replace.ts` | `str_replace_editor` tool implementation |
| `src/lib/tools/file-manager.ts` | `file_manager` tool implementation |
| `src/lib/transform/jsx-transformer.ts` | Transforms JSX for browser preview |
| `prisma/schema.prisma` | SQLite schema: `User` and `Project` models |

### Database

SQLite via Prisma. `Project` stores chat history and the full virtual file system as JSON blobs. No relational file storage.
