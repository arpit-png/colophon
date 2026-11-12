# Colophon

**Library circulation on a verifiable ledger.**

Colophon is an interactive blockchain library circulation web application built with Next.js, Framer Motion, Lucide Icons, and browser-native WebCrypto primitives (`ECDSA P-256` keypairs and `SHA-256` hashing).

## Features

- **WebCrypto Wallets & Signatures** (`src/lib/colophon-ledger.ts`): Each librarian and member generates an `ECDSA P-256` keypair in browser storage with `SHA-256` address derivation. Every `REGISTER`, `BORROW`, and `RETURN` transaction is canonically serialized and signed.
- **Merkle-Sealed Proof-of-Work Blocks**: Mempool entries fold into a binary SHA-256 Merkle root and seal with selectable leading-zero difficulty (`d=2` through `d=4`, `MIN_DIFF = 2`).
- **Deterministic State Replay & Tamper Check**: Catalog ownership, the 3-volume limit, 14-day loan windows, and librarian authorization are derived from replaying genesis `#0` forward. Tamper backdating immediately triggers verification failure detection.
- **Colophon Guide AI (`src/components/ColophonNavigatorAI.tsx`)**: Floating bottom-left assistant that helps new users locate volumes, switch wallets, trigger actions, mine blocks, and run tamper checks.
- **Motion & Archival UI (`src/components/`)**: `ColophonShowcase`, `ThemeToggleButton` (View Transitions), `DynamicStatusPill`, `TextRoll`, `AnimatedNumber`, `SmoothInput`, `FadeScrollArea`, `SpringCursorGlow`, and `MotionIcons`.

## Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Preview Anytime

- **One-step build & preview**:
  ```bash
  npm run preview
  ```
- **Windows quick launcher**: Double-click `Preview Colophon.cmd` in the workspace root (`BlockChain\`) to start the local preview server (if not already running) and open `http://localhost:3000`.
- **IDE Task**: Run the `Preview Colophon` (or `Dev Colophon`) task from `.vscode/tasks.json`.

## Deployment (Vercel & Netlify)

No environment variables or external databases are required.

- **Vercel**: Import this directory as a Next.js project (`npm run build`, framework `nextjs`).
- **Netlify**: Configured via `netlify.toml` (`npm run build`, publish `.next`, `NODE_VERSION = "20"`).
