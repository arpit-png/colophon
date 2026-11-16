"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Compass,
  CornerDownRight,
  Pickaxe,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { FadeScrollArea } from "@/components/FadeScrollArea";
import type { ThemeMode } from "@/components/ThemeToggle";
import {
  LOAN_DAYS,
  MAX_LOANS,
  shortHash,
  type BookRecord,
  type LedgerBlock,
  type LedgerTx,
  type Wallet,
} from "@/lib/colophon-ledger";

export type SectionTarget = "top" | "principles" | "protocol" | "folio" | "desk" | "ledger";

export type NavigatorAction = {
  id: string;
  label: string;
  tone?: "primary" | "ghost" | "warn";
  run: () => Promise<unknown> | unknown;
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  actions?: NavigatorAction[];
};

export interface ColophonNavigatorAIProps {
  ready: boolean;
  chain: LedgerBlock[];
  pool: LedgerTx[];
  wallets: Wallet[];
  activeWallet: Wallet | null;
  books: BookRecord[];
  chainOK: boolean;
  failedBlockIndex: number | null;
  hasSnapshot: boolean;
  busyMining: boolean;
  theme: ThemeMode;
  onLocateSection: (section: SectionTarget) => void;
  onSearchBook: (query: string) => void;
  onFilterBooks: (filter: "all" | "available" | "borrowed") => void;
  onBorrowBook: (bookId: string) => Promise<boolean>;
  onReturnBook: (bookId: string) => Promise<boolean>;
  onOpenProvenance: (bookId: string) => void;
  onMine: () => Promise<void>;
  onSelectWallet: (address: string) => void;
  onCreateMember: () => Promise<void>;
  onOpenRegisterForm: () => void;
  onSelectBlock: (index: number) => void;
  onVerifyChain: () => Promise<boolean>;
  onTamper: () => Promise<void>;
  onRestore: () => Promise<void>;
  onToggleTheme: () => void;
}

const QUICK_PROMPTS = [
  "Walk me through Colophon",
  "Borrow an available book",
  "Register a new volume",
  "Inspect & tamper test ledger",
];

function findMatchingBooks(query: string, books: BookRecord[]): BookRecord[] {
  const q = query.toLowerCase();
  const stopWords = new Set([
    "find",
    "locate",
    "where",
    "is",
    "book",
    "volume",
    "borrow",
    "checkout",
    "check",
    "out",
    "return",
    "provenance",
    "history",
    "the",
    "a",
    "an",
    "to",
    "for",
    "me",
    "show",
    "open",
    "search",
    "author",
    "by",
  ]);
  const tokens = q
    .replace(/[^a-z0-9-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  if (!tokens.length) return [];

  return books
    .map((b) => {
      const hay = `${b.id} ${b.title} ${b.author} ${b.call} ${b.year}`.toLowerCase();
      const score = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
      return { book: b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book);
}

export function ColophonNavigatorAI(props: ColophonNavigatorAIProps) {
  const {
    ready,
    chain,
    pool,
    wallets,
    activeWallet,
    books,
    chainOK,
    failedBlockIndex,
    hasSnapshot,
    busyMining,
    theme,
    onLocateSection,
    onSearchBook,
    onFilterBooks,
    onBorrowBook,
    onReturnBook,
    onOpenProvenance,
    onMine,
    onSelectWallet,
    onCreateMember,
    onOpenRegisterForm,
    onSelectBlock,
    onVerifyChain,
    onTamper,
    onRestore,
    onToggleTheme,
  } = props;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "I am the Colophon Guide. Ask me to locate any volume, switch between Librarian and Member wallets, queue or seal transactions, or walk you through tamper verification.",
    },
  ]);

  const msgSeq = useRef(2);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);
  const blockHeight = Math.max(0, chain.length - 1);
  const librarianWallet = useMemo(() => wallets.find((w) => w.role === "librarian") ?? null, [wallets]);
  const memberWallets = useMemo(() => wallets.filter((w) => w.role === "member"), [wallets]);
  const availableBooks = useMemo(() => books.filter((b) => b.status === "available"), [books]);
  const myLoans = useMemo(
    () => (activeWallet ? books.filter((b) => b.holder === activeWallet.address) : []),
    [books, activeWallet],
  );

  const appendAssistant = (text: string, actions?: NavigatorAction[]) => {
    msgSeq.current += 1;
    setMessages((prev) => [...prev, { id: msgSeq.current, role: "assistant", text, actions }]);
  };

  const handleQuery = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    msgSeq.current += 1;
    setMessages((prev) => [...prev, { id: msgSeq.current, role: "user", text }]);
    setInput("");

    if (!ready) {
      appendAssistant("The genesis block is still finishing in WebCrypto. Give it a moment and try again.");
      return;
    }

    const q = text.toLowerCase();
    const matchedBooks = findMatchingBooks(text, books);
    const firstMatch = matchedBooks[0] ?? null;

    // 1. Tamper / Integrity / Restore / Verify queries
    if (/(restore|undo|fix chain|repair)/.test(q)) {
      onLocateSection("ledger");
      if (hasSnapshot) {
        await onRestore();
        appendAssistant(
          "Restored the original snapshot and re-verified all hashes, Merkle roots, and ECDSA signatures in Section 04 (Ledger).",
          [{ id: "locate-ledger", label: "View Ledger", run: () => onLocateSection("ledger") }],
        );
      } else {
        appendAssistant(
          "No tamper snapshot is currently saved. Use 'Backdate a record' in the Ledger first to simulate tampering.",
          [
            { id: "go-ledger", label: "Go to Ledger", run: () => onLocateSection("ledger") },
            {
              id: "run-tamper",
              label: `Backdate Block #${blockHeight}`,
              tone: "warn",
              run: async () => {
                onSelectBlock(blockHeight);
                onLocateSection("ledger");
                await onTamper();
              },
            },
          ],
        );
      }
      return;
    }

    if (/(tamper|backdate|cheat|forge|corrupt|break)/.test(q)) {
      onSelectBlock(blockHeight);
      onLocateSection("ledger");
      await onTamper();
      appendAssistant(
        `Simulated a tampering attack by backdating the latest entry in Block #${blockHeight} and recomputing its hashes without re-mining PoW. Look at Section 04 (Ledger) to inspect why verification fails.`,
        [
          {
            id: "restore-now",
            label: "Restore original ledger",
            tone: "primary",
            run: () => onRestore(),
          },
          { id: "inspect-blk", label: `Inspect Block #${blockHeight}`, run: () => onLocateSection("ledger") },
        ],
      );
      return;
    }

    if (/(verify|audit|validate|integrity|check chain)/.test(q)) {
      onLocateSection("ledger");
      const ok = await onVerifyChain();
      appendAssistant(
        ok
          ? `Verified all ${chain.length} block${chain.length > 1 ? "s" : ""} from genesis (#0) to #${blockHeight}: prev-hash links, Merkle roots, PoW targets, ECDSA P-256 signatures, and circulation rules all hold.`
          : `Integrity check failed at Block #${failedBlockIndex ?? 0}. Inspect the broken proof below in the Ledger or restore the pre-tamper snapshot.`,
        hasSnapshot
          ? [{ id: "restore-ledger", label: "Restore original", tone: "primary", run: () => onRestore() }]
          : [{ id: "view-ledger", label: "Inspect Ledger", run: () => onLocateSection("ledger") }],
      );
      return;
    }

    // 2. Seal / Mine queries
    if (/(seal|mine|pow|proof of work|commit|mempool)/.test(q) && !/explain|what is|how/.test(q)) {
      onLocateSection("desk");
      if (busyMining) {
        appendAssistant("A block is already being mined — check the Mempool panel for live nonce progress.");
        return;
      }
      if (!pool.length) {
        const sample = availableBooks[0];
        appendAssistant(
          "The mempool currently has 0 pending entries. Queue a Borrow, Return, or Volume Registration first, then seal a block.",
          sample
            ? [
                {
                  id: "borrow-sample",
                  label: `Borrow ${sample.id} (${sample.title})`,
                  tone: "primary",
                  run: async () => {
                    onLocateSection("desk");
                    await onBorrowBook(sample.id);
                  },
                },
                { id: "go-desk", label: "Open Circulation desk", run: () => onLocateSection("desk") },
              ]
            : undefined,
        );
        return;
      }
      if (!chainOK) {
        appendAssistant(
          `Cannot mine while Block #${failedBlockIndex ?? 0} has an integrity failure. Restore the original chain first.`,
          hasSnapshot
            ? [{ id: "restore-before-mine", label: "Restore original", tone: "primary", run: () => onRestore() }]
            : undefined,
        );
        return;
      }
      const queuedCount = pool.length;
      await onMine();
      appendAssistant(
        `Sealed ${queuedCount} pending entr${queuedCount === 1 ? "y" : "ies"} into Block #${chain.length}! You can inspect its Merkle root and signed entries in the Ledger.`,
        [
          {
            id: "view-new-block",
            label: `Inspect Block #${chain.length}`,
            tone: "primary",
            run: () => {
              onSelectBlock(chain.length);
              onLocateSection("ledger");
            },
          },
        ],
      );
      return;
    }

    // 3. Register book / Librarian queries
    if (/(register|add book|add volume|new book|new volume|catalog)/.test(q)) {
      onOpenRegisterForm();
      appendAssistant(
        `Opened 'Register a volume' in the Circulation desk sidebar${
          activeWallet?.role !== "librarian" && librarianWallet
            ? " and switched your active signer to the Librarian wallet (only genesis-authorized librarians can register volumes)."
            : "."
        } Fill in Title, Author, Call no., and Year, then click Sign & queue.`,
        [
          { id: "scroll-desk-reg", label: "Focus registration form", run: () => onOpenRegisterForm() },
          ...(pool.length > 0
            ? [{ id: "seal-after-reg", label: `Seal ${pool.length} queued`, tone: "primary" as const, run: () => onMine() }]
            : []),
        ],
      );
      return;
    }

    // 4. Wallet / Member queries
    if (/(new wallet|create wallet|new member|add member|keypair|switch wallet|librarian|member)/.test(q)) {
      if (/(new wallet|create wallet|new member|add member|generate)/.test(q)) {
        await onCreateMember();
        onLocateSection("desk");
        appendAssistant(
          "Generated a fresh browser-local ECDSA P-256 keypair and switched your active wallet to the new Member.",
          [{ id: "go-wallet", label: "Locate wallet panel", run: () => onLocateSection("desk") }],
        );
        return;
      }
      if (/librarian/.test(q) && librarianWallet) {
        onSelectWallet(librarianWallet.address);
        onLocateSection("desk");
        appendAssistant(
          `Switched active wallet to ${librarianWallet.name} (${shortHash(librarianWallet.address, 8, 4)}). Librarians can register volumes and borrow up to ${MAX_LOANS} books.`,
          [{ id: "open-reg", label: "Open Register form", tone: "primary", run: () => onOpenRegisterForm() }],
        );
        return;
      }
      if (/member/.test(q) && memberWallets[0]) {
        onSelectWallet(memberWallets[0].address);
        onLocateSection("desk");
        appendAssistant(
          `Switched active wallet to ${memberWallets[0].name} (${shortHash(memberWallets[0].address, 8, 4)}). Members can borrow and return volumes (limit ${MAX_LOANS}, ${LOAN_DAYS}-day loan window).`,
        );
        return;
      }
      onLocateSection("desk");
      appendAssistant(
        `Active signer: ${activeWallet?.name ?? "None"} (${activeWallet?.role ?? "—"}, ${myLoans.length}/${MAX_LOANS} loans). You can switch identities or mint a new ECDSA P-256 keypair below.`,
        [
          ...(librarianWallet && activeWallet?.address !== librarianWallet.address
            ? [
                {
                  id: "to-lib",
                  label: "Switch to Librarian",
                  run: () => onSelectWallet(librarianWallet.address),
                },
              ]
            : []),
          ...(memberWallets[0] && activeWallet?.address !== memberWallets[0].address
            ? [
                {
                  id: "to-mem",
                  label: `Switch to ${memberWallets[0].name}`,
                  run: () => onSelectWallet(memberWallets[0].address),
                },
              ]
            : []),
          {
            id: "mint-mem",
            label: "+ New member wallet",
            tone: "primary",
            run: () => onCreateMember(),
          },
        ],
      );
      return;
    }

    // 5. Book lookup / Borrow / Return / Provenance
    if (firstMatch || /(borrow|checkout|check out|return|available|on loan|loan|catalogue|catalog|book)/.test(q)) {
      const target = firstMatch ?? availableBooks[0] ?? books[0];

      if (/available/.test(q) && !firstMatch) {
        onFilterBooks("available");
        onSearchBook("");
        onLocateSection("desk");
        if (/borrow/.test(q) && availableBooks[0]) {
          const picked = availableBooks[0];
          const ok = await onBorrowBook(picked.id);
          appendAssistant(
            ok
              ? `Filtered to available volumes and signed a BORROW entry for ${picked.id} (${picked.title}). Seal the block when ready to commit it permanently.`
              : `Filtered to ${availableBooks.length} available volumes in the Circulation desk.`,
            [
              {
                id: "seal-borrowed",
                label: "Seal block now",
                tone: "primary",
                run: () => onMine(),
              },
              {
                id: "prov-picked",
                label: `Show ${picked.id} provenance`,
                run: () => onOpenProvenance(picked.id),
              },
            ],
          );
          return;
        }
        appendAssistant(
          `Showing ${availableBooks.length} available volume${availableBooks.length === 1 ? "" : "s"} in the Circulation desk. Click Borrow on any row to sign a checkout.`,
          availableBooks[0]
            ? [
                {
                  id: "borrow-first-av",
                  label: `Borrow ${availableBooks[0].id} (${availableBooks[0].title})`,
                  tone: "primary",
                  run: () => onBorrowBook(availableBooks[0].id),
                },
              ]
            : undefined,
        );
        return;
      }

      if (/(on loan|loaned|borrowed list)/.test(q) && !firstMatch) {
        onFilterBooks("borrowed");
        onSearchBook("");
        onLocateSection("desk");
        appendAssistant("Filtered the catalogue to volumes currently on loan.");
        return;
      }

      if (target) {
        onFilterBooks("all");
        onSearchBook(firstMatch ? target.id : "");
        onLocateSection("desk");

        if (/return/.test(q)) {
          const candidate = firstMatch && firstMatch.status === "borrowed" ? firstMatch : myLoans[0] ?? target;
          if (candidate.status !== "borrowed") {
            appendAssistant(`${candidate.id} (${candidate.title}) is already marked Available on the ledger.`);
            return;
          }
          const ok = await onReturnBook(candidate.id);
          appendAssistant(
            ok
              ? `Signed RETURN for ${candidate.id} (${candidate.title}) and queued it in the mempool.`
              : `Could not return ${candidate.id} with ${activeWallet?.name} — only the current borrower's key can return a loaned volume.`,
            ok
              ? [{ id: "seal-ret", label: "Seal block now", tone: "primary", run: () => onMine() }]
              : undefined,
          );
          return;
        }

        if (/borrow|checkout|check out/.test(q)) {
          const ok = await onBorrowBook(target.id);
          appendAssistant(
            ok
              ? `Located ${target.id} (${target.title}) and queued a signed BORROW transaction under ${activeWallet?.name}. Seal the mempool to append Block #${chain.length}.`
              : `Located ${target.id} (${target.title}), currently ${target.status}.`,
            ok
              ? [
                  { id: "seal-q", label: "Seal block now", tone: "primary", run: () => onMine() },
                  { id: "show-prov", label: "Open Provenance", run: () => onOpenProvenance(target.id) },
                ]
              : [{ id: "show-prov", label: "Open Provenance", run: () => onOpenProvenance(target.id) }],
          );
          return;
        }

        if (/provenance|history/.test(q)) {
          onOpenProvenance(target.id);
        }

        const isMine = activeWallet && target.holder === activeWallet.address;
        appendAssistant(
          `Located ${target.id} — "${target.title}" by ${target.author} (${target.year}, ${target.call}). Status: ${target.status === "available" ? "Available" : "On loan"}.`,
          [
            ...(target.status === "available"
              ? [
                  {
                    id: `act-borrow-${target.id}`,
                    label: `Borrow ${target.id}`,
                    tone: "primary" as const,
                    run: () => onBorrowBook(target.id),
                  },
                ]
              : []),
            ...(target.status === "borrowed" && isMine
              ? [
                  {
                    id: `act-ret-${target.id}`,
                    label: `Return ${target.id}`,
                    tone: "primary" as const,
                    run: () => onReturnBook(target.id),
                  },
                ]
              : []),
            {
              id: `act-prov-${target.id}`,
              label: "View Provenance",
              run: () => onOpenProvenance(target.id),
            },
          ],
        );
        return;
      }
    }

    // 6. Theme switching
    if (/(theme|dark|light|nocturnal|paper mode|appearance)/.test(q)) {
      const nextName = theme === "light" ? "Nocturnal Reading Room (dark)" : "Archival Paper (light)";
      onToggleTheme();
      appendAssistant(`Switched theme to ${nextName}. You can also customize the transition effect (Circle, Soft, Swipe, Slice) in the top status capsule.`);
      return;
    }

    // 7. Section navigation / Tour / Explanations
    if (/(folio|binding|showcase|card|carousel)/.test(q)) {
      onLocateSection("folio");
      appendAssistant(
        "Scrolled to the Interactive Archival Folio inside Section 02 (Protocol), where you can preview binding cloth finishes and step through Keypairs, Merkle Seal, Proof of Work, and State Replay.",
      );
      return;
    }

    if (/(principle|manifesto|why|overview)/.test(q)) {
      onLocateSection("principles");
      appendAssistant(
        "Scrolled to Section 01 — Principles: Provenance, Accountability, and Continuity.",
        [{ id: "next-proto", label: "Next: Protocol", run: () => onLocateSection("protocol") }],
      );
      return;
    }

    if (/(block\s*#?\d+|latest block|ledger|merkle|hash|nonce)/.test(q)) {
      const numMatch = q.match(/block\s*#?(\d+)/);
      const targetIdx = numMatch ? Math.min(chain.length - 1, Math.max(0, parseInt(numMatch[1], 10))) : blockHeight;
      onSelectBlock(targetIdx);
      onLocateSection("ledger");
      const blk = chain[targetIdx];
      appendAssistant(
        blk
          ? `Selected Block #${blk.index} in the Ledger: ${blk.txs.length} signed entries, Merkle root ${shortHash(blk.merkle, 8, 4)}, nonce ${blk.nonce.toLocaleString("en-US")}, difficulty ${blk.difficulty}.`
          : "Scrolled to Section 04 — Ledger.",
        [
          { id: "verify-all", label: "Verify entire chain", tone: "primary", run: () => onVerifyChain() },
          { id: "try-tamper", label: "Test tampering", tone: "warn", run: () => onTamper() },
        ],
      );
      return;
    }

    // Default / Guided Walkthrough
    appendAssistant(
      "Here is how Colophon works in 4 live steps: (1) Pick or mint a WebCrypto ECDSA P-256 wallet at the Circulation desk, (2) Borrow, return, or (as Librarian) register a volume into the Mempool, (3) Seal queued entries into a SHA-256 Merkle block via Proof of Work, and (4) Inspect or tamper-test the Ledger.",
      [
        {
          id: "tour-folio",
          label: "1. Interactive Folio",
          run: () => onLocateSection("folio"),
        },
        {
          id: "tour-desk",
          label: "2. Circulation desk",
          tone: "primary",
          run: () => onLocateSection("desk"),
        },
        {
          id: "tour-ledger",
          label: "3. Block Ledger",
          run: () => onLocateSection("ledger"),
        },
      ],
    );
  };

  const statusSummary = !ready
    ? "Booting WebCrypto ledger…"
    : !chainOK
      ? `Alert: Integrity failure at Block #${failedBlockIndex ?? 0}`
      : pool.length > 0
        ? `${pool.length} queued entry waiting to be sealed`
        : `${activeWallet?.name ?? "Ready"} · Block #${blockHeight}`;

  return (
    <div className="nav-ai-root">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="nav-ai-panel"
            aria-label="Colophon Navigation AI Assistant"
          >
            <header className="nav-ai-head">
              <div className="nav-ai-title-wrap">
                <span className="nav-ai-badge" aria-hidden="true">
                  <Sparkles size={13} />
                </span>
                <div>
                  <h3 className="nav-ai-title">Colophon Guide</h3>
                  <p className="nav-ai-sub mono">{statusSummary}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation assistant"
                className="icon-btn nav-ai-close"
              >
                <X size={15} />
              </button>
            </header>

            {/* Situational Next-Step Strip */}
            <div className={`nav-ai-callout${!chainOK ? " is-warn" : ""}`}>
              {!chainOK ? (
                <>
                  <ShieldAlert size={14} className="nav-ai-callout-ico" />
                  <span>Integrity broken at Block #{failedBlockIndex ?? 0}.</span>
                  {hasSnapshot ? (
                    <button type="button" className="nav-ai-inline-btn" onClick={() => void onRestore()}>
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="nav-ai-inline-btn"
                      onClick={() => onLocateSection("ledger")}
                    >
                      Inspect
                    </button>
                  )}
                </>
              ) : pool.length > 0 ? (
                <>
                  <Pickaxe size={14} className="nav-ai-callout-ico" />
                  <span>
                    {pool.length} entry ready to seal into Block #{chain.length}.
                  </span>
                  <button
                    type="button"
                    className="nav-ai-inline-btn"
                    disabled={busyMining}
                    onClick={() => void onMine()}
                  >
                    {busyMining ? "Mining…" : "Seal block"}
                  </button>
                </>
              ) : (
                <>
                  <BookOpen size={14} className="nav-ai-callout-ico" />
                  <span>Next: search or borrow a volume, then seal a block.</span>
                  <button
                    type="button"
                    className="nav-ai-inline-btn"
                    onClick={() => onLocateSection("desk")}
                  >
                    Desk
                  </button>
                </>
              )}
            </div>

            {/* Quick Section & Action Shortcuts */}
            <div className="nav-ai-quick-row">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="nav-ai-chip"
                  onClick={() => void handleQuery(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Conversation Feed */}
            <FadeScrollArea maxHeight={240} className="nav-ai-feed-wrap" ariaLabel="Guide messages">
              <div className="nav-ai-feed">
                {messages.map((msg) => (
                  <div key={msg.id} className={`nav-ai-msg is-${msg.role}`}>
                    <p>{msg.text}</p>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="nav-ai-actions">
                        {msg.actions.map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => void act.run()}
                            className={`nav-ai-act-btn${act.tone ? ` is-${act.tone}` : ""}`}
                          >
                            <CornerDownRight size={12} aria-hidden="true" />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={feedEndRef} />
              </div>
            </FadeScrollArea>

            {/* Quick Action Bar */}
            <div className="nav-ai-bar" role="group" aria-label="Direct shortcuts">
              <button
                type="button"
                className="nav-ai-mini"
                onClick={() => {
                  onFilterBooks("all");
                  onSearchBook("");
                  onLocateSection("desk");
                }}
              >
                <BookOpen size={12} /> Desk
              </button>
              <button
                type="button"
                className="nav-ai-mini"
                onClick={() => void onCreateMember()}
              >
                <UserPlus size={12} /> Wallet
              </button>
              <button
                type="button"
                className="nav-ai-mini"
                onClick={() => {
                  onLocateSection("ledger");
                  void onVerifyChain();
                }}
              >
                <ShieldCheck size={12} /> Verify
              </button>
            </div>

            {/* Input Form */}
            <form
              className="nav-ai-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleQuery(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask: find Borges, borrow, seal, verify…"
                aria-label="Ask the Colophon Navigation AI"
                className="nav-ai-input"
              />
              <button type="submit" aria-label="Send query" className="nav-ai-send">
                <Send size={14} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Bottom-Left Floating Guide Button (replaces the N indicator) */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-expanded={open}
        aria-label={open ? "Close Colophon Guide AI" : "Open Colophon Guide AI"}
        className={`nav-ai-fab${!chainOK ? " is-alert" : pool.length > 0 ? " is-pending" : ""}`}
      >
        <span className="nav-ai-fab-icon" aria-hidden="true">
          {open ? <X size={16} /> : <Compass size={16} />}
        </span>
        <span className="nav-ai-fab-label">Guide AI</span>
        {(!chainOK || pool.length > 0) && (
          <span className="nav-ai-fab-dot mono">{!chainOK ? "!" : pool.length}</span>
        )}
      </motion.button>
    </div>
  );
}
