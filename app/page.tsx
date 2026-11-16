"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ColophonNavigatorAI, type SectionTarget } from "@/components/ColophonNavigatorAI";
import { ColophonShowcase } from "@/components/ColophonShowcase";
import { DynamicStatusPill } from "@/components/DynamicStatusPill";
import { FadeScrollArea } from "@/components/FadeScrollArea";
import { ArrowIcon, MenuIcon, VolumeIcon } from "@/components/MotionIcons";
import { SmoothInput } from "@/components/SmoothInput";
import { TextRoll } from "@/components/TextRoll";
import { ThemeToggleButton, useColophonTheme, type TransitionVariant } from "@/components/ThemeToggle";
import {
  LS,
  MAX_LOANS,
  SHELF_SPINES,
  applyTx,
  blockHash,
  bootstrapLedger,
  cloneChain,
  computeState,
  fmtDate,
  fmtTime,
  getHashCount,
  leadingZeros,
  merkleRoot,
  mineBlock,
  newWallet,
  resetHashCount,
  shortHash,
  signTx,
  validateChain,
  type BookPayload,
  type GenesisPayload,
  type LedgerBlock,
  type LedgerTx,
  type ValidationEntry,
  type Wallet,
} from "@/lib/colophon-ledger";

type ToastItem = {
  id: number;
  message: string;
  kind: "ok" | "err";
};

type CueKind = "queue" | "seal" | "verify" | "err";

const MARQUEE_WORDS = [
  "Signed by the reader",
  "Sealed in a block",
  "Verified by anyone",
  "Never quietly rewritten",
  "Every loan has a witness",
];

function renderHashLeading(h: string, sliceLen?: number) {
  const shown = sliceLen ? h.slice(0, sliceLen) : h;
  const z = Math.min(leadingZeros(h), shown.length);
  return (
    <>
      <b className="z">{shown.slice(0, z)}</b>
      {shown.slice(z)}
      {sliceLen && h.length > sliceLen ? "…" : ""}
    </>
  );
}

export default function ColophonPage() {
  const [transitionVariant, setTransitionVariant] = useState<TransitionVariant>("circle");
  const { theme, toggleTheme } = useColophonTheme(transitionVariant);

  const [muted, setMuted] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [chain, setChain] = useState<LedgerBlock[]>([]);
  const [pool, setPool] = useState<LedgerTx[]>([]);
  const [activeAddr, setActiveAddr] = useState<string>("");
  const [selBlock, setSelBlock] = useState<number>(0);
  const [report, setReport] = useState<ValidationEntry[] | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [hashesComputed, setHashesComputed] = useState(0);

  const [ready, setReady] = useState(false);
  const [bootMessage, setBootMessage] = useState("Preparing the ledger…");
  const [bootError, setBootError] = useState<string | null>(null);
  const [busyMining, setBusyMining] = useState(false);

  const [filter, setFilter] = useState<"all" | "available" | "borrowed">("all");
  const [query, setQuery] = useState("");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const [rTitle, setRTitle] = useState("");
  const [rAuthor, setRAuthor] = useState("");
  const [rCall, setRCall] = useState("");
  const [rYear, setRYear] = useState("");
  const [regOpen, setRegOpen] = useState(false);

  const [difficulty, setDifficulty] = useState(3);
  const [mineOutput, setMineOutput] = useState("Idle. Queue an entry to begin.");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toastSeq = useRef(0);
  const bootStarted = useRef(false);
  const chainRef = useRef<HTMLDivElement>(null);
  const regTitleRef = useRef<HTMLInputElement>(null);
  const dragState = useRef({ active: false, moved: false, startX: 0, startLeft: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 180, damping: 28, restDelta: 0.001 });

  const playCue = useCallback(
    (kind: CueKind) => {
      if (muted || typeof window === "undefined") return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        const now = ctx.currentTime;
        const notes =
          kind === "seal"
            ? [392, 493.88, 587.33]
            : kind === "verify"
              ? [440, 554.37]
              : kind === "err"
                ? [220, 185]
                : [523.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = kind === "err" ? "triangle" : "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.045, now + idx * 0.055 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.055);
          osc.stop(now + idx * 0.055 + 0.24);
        });
      } catch {
        // Ignore audio context blocks when autoplay is disallowed
      }
    },
    [muted],
  );

  const pushToast = useCallback(
    (message: string, kind: "ok" | "err" = "ok") => {
      toastSeq.current += 1;
      const id = toastSeq.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      if (kind === "err") playCue("err");
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    [playCue],
  );

  const persistAll = useCallback((nextChain: LedgerBlock[], nextPool: LedgerTx[], nextWallets: Wallet[]) => {
    window.localStorage.setItem(LS.chain, JSON.stringify(nextChain));
    window.localStorage.setItem(LS.pool, JSON.stringify(nextPool));
    window.localStorage.setItem(LS.wallets, JSON.stringify(nextWallets));
  }, []);

  const runValidation = useCallback(
    async (targetChain: LedgerBlock[], silent: boolean) => {
      const nextReport = await validateChain(targetChain);
      setReport(nextReport);
      setHashesComputed(getHashCount());
      const ok = nextReport.every((r) => r.ok);
      if (!silent) {
        if (ok) {
          playCue("verify");
          pushToast(
            `Verified ${targetChain.length} block${targetChain.length > 1 ? "s" : ""} — all hashes, signatures and rules hold`,
          );
        } else {
          const failed = nextReport.find((r) => !r.ok);
          pushToast(`Integrity failure detected at block #${failed?.index ?? 0}`, "err");
        }
      }
      return ok;
    },
    [playCue, pushToast],
  );

  useEffect(() => {
    if (bootStarted.current) return;
    bootStarted.current = true;

    const init = async () => {
      try {
        if (!window.crypto || !window.crypto.subtle) {
          throw new Error("WebCrypto unavailable (open over https or localhost)");
        }
        resetHashCount();
        let loadedWallets = JSON.parse(window.localStorage.getItem(LS.wallets) || "[]") as Wallet[];
        let loadedChain = JSON.parse(window.localStorage.getItem(LS.chain) || "[]") as LedgerBlock[];
        let loadedPool = JSON.parse(window.localStorage.getItem(LS.pool) || "[]") as LedgerTx[];

        if (!loadedWallets.length || !loadedChain.length) {
          setBootMessage("Generating keys and mining the genesis block…");
          const seeded = await bootstrapLedger((attempts) => {
            setBootMessage(`Mining genesis block… ${attempts.toLocaleString("en-US")} attempts`);
          });
          loadedWallets = seeded.wallets;
          loadedChain = seeded.chain;
          loadedPool = seeded.pool;
          window.localStorage.removeItem(LS.snap);
          persistAll(loadedChain, loadedPool, loadedWallets);
        }

        const storedSel = window.localStorage.getItem(LS.sel);
        const initialWallet =
          loadedWallets.find((w) => w.address === storedSel) || loadedWallets[1] || loadedWallets[0];

        setWallets(loadedWallets);
        setChain(loadedChain);
        setPool(loadedPool);
        setActiveAddr(initialWallet?.address ?? "");
        setHasSnapshot(Boolean(window.localStorage.getItem(LS.snap)));
        setSelBlock(0);
        setReady(true);
        await runValidation(loadedChain, true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown initialization error";
        setBootError(msg);
      }
    };

    void init();
  }, [persistAll, runValidation]);

  const activeWallet = useMemo(
    () => wallets.find((w) => w.address === activeAddr) || wallets[0] || null,
    [wallets, activeAddr],
  );

  const libraryState = useMemo(() => computeState(chain, pool, true), [chain, pool]);

  const nameOf = useCallback(
    (addr: string | null | undefined) => {
      if (!addr) return "";
      const w = wallets.find((item) => item.address === addr);
      return w ? w.name : shortHash(addr, 6, 4);
    },
    [wallets],
  );

  const chainOK = useMemo(() => (report ? report.every((r) => r.ok) : true), [report]);
  const failedBlockIndex = useMemo(() => report?.find((r) => !r.ok)?.index ?? null, [report]);

  const blockHeight = Math.max(0, chain.length - 1);
  const latestBlock = chain[blockHeight] ?? null;
  const totalTxCount = useMemo(() => chain.reduce((sum, blk) => sum + blk.txs.length, 0), [chain]);

  const activeLoansCount = useMemo(() => {
    if (!activeWallet) return 0;
    return [...libraryState.books.values()].filter((b) => b.holder === activeWallet.address).length;
  }, [libraryState, activeWallet]);

  const filteredBooks = useMemo(() => {
    let items = [...libraryState.books.values()];
    if (filter !== "all") {
      items = items.filter((b) => b.status === filter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((b) => `${b.title} ${b.author} ${b.id} ${b.call}`.toLowerCase().includes(q));
    }
    return items;
  }, [libraryState, filter, query]);

  const queueTx = useCallback(
    async (p: { type: "REGISTER" | "BORROW" | "RETURN"; bookId: string; data?: BookPayload }) => {
      if (busyMining) {
        pushToast("A block is being sealed — please wait.", "err");
        return false;
      }
      if (!activeWallet) {
        pushToast("No signing wallet loaded yet.", "err");
        return false;
      }
      const tx = await signTx(activeWallet, p);
      const test = computeState(chain, pool, true);
      const err = applyTx(test, tx, "pending");
      if (err) {
        pushToast(err, "err");
        return false;
      }
      const nextPool = [...pool, tx];
      setPool(nextPool);
      persistAll(chain, nextPool, wallets);
      setHashesComputed(getHashCount());
      playCue("queue");
      pushToast(`${tx.type} signed by ${activeWallet.name} — queued`);
      return true;
    },
    [busyMining, activeWallet, chain, pool, wallets, persistAll, playCue, pushToast],
  );

  const handleCreateMember = useCallback(async () => {
    const memberCount = wallets.filter((w) => w.role === "member").length + 1;
    const created = await newWallet(`Member ${String(memberCount).padStart(2, "0")}`, "member");
    const nextWallets = [...wallets, created];
    setWallets(nextWallets);
    setActiveAddr(created.address);
    window.localStorage.setItem(LS.sel, created.address);
    persistAll(chain, pool, nextWallets);
    setHashesComputed(getHashCount());
    playCue("queue");
    pushToast(`New keypair generated — ${created.name} · ${shortHash(created.address, 8, 4)}`);
  }, [wallets, chain, pool, persistAll, playCue, pushToast]);

  const handleRegisterVolume = useCallback(async () => {
    const title = rTitle.trim();
    const author = rAuthor.trim();
    const call = rCall.trim() || "—";
    const year = parseInt(rYear, 10);
    if (!title || !author || Number.isNaN(year)) {
      pushToast("Title, author and year are required.", "err");
      return;
    }
    const id = `LB-${String(libraryState.books.size + 1).padStart(4, "0")}`;
    const ok = await queueTx({
      type: "REGISTER",
      bookId: id,
      data: { title, author, year, call },
    });
    if (ok) {
      setRTitle("");
      setRAuthor("");
      setRCall("");
      setRYear("");
    }
  }, [rTitle, rAuthor, rCall, rYear, libraryState.books.size, queueTx, pushToast]);

  const handleMine = useCallback(async () => {
    if (busyMining) return;
    if (!pool.length) {
      pushToast("Nothing to seal. Queue an entry first.", "err");
      return;
    }
    if (!chainOK) {
      pushToast("Chain failed verification — refusing to extend it.", "err");
      return;
    }
    const prev = chain[chain.length - 1];
    if (!prev) return;

    setBusyMining(true);
    const txs = [...pool];
    const blk = await mineBlock(chain.length, prev.hash, txs, difficulty, (nonce, hash) => {
      setMineOutput(`nonce ${nonce.toLocaleString("en-US")} · ${hash.slice(0, 32)}…`);
    });

    const nextChain = [...chain, blk];
    const nextPool: LedgerTx[] = [];
    setChain(nextChain);
    setPool(nextPool);
    setSelBlock(blk.index);
    setBusyMining(false);
    setMineOutput(
      `Sealed block #${blk.index} in ${((blk.ms ?? 0) / 1000).toFixed(2)}s · ${(blk.attempts ?? 1).toLocaleString("en-US")} attempts · ${blk.hash.slice(0, 28)}…`,
    );
    persistAll(nextChain, nextPool, wallets);
    await runValidation(nextChain, true);
    playCue("seal");
    pushToast(`Block #${blk.index} sealed — ${blk.txs.length} entr${blk.txs.length > 1 ? "ies" : "y"}`);

    window.setTimeout(() => {
      if (chainRef.current) {
        chainRef.current.scrollTo({ left: chainRef.current.scrollWidth, behavior: "smooth" });
      }
    }, 60);
  }, [busyMining, pool, chainOK, chain, difficulty, wallets, persistAll, runValidation, playCue, pushToast]);

  const handleTamper = useCallback(async () => {
    const target = chain[selBlock];
    if (!target || !target.txs.length) return;
    if (!window.localStorage.getItem(LS.snap)) {
      window.localStorage.setItem(LS.snap, JSON.stringify(chain));
      setHasSnapshot(true);
    }
    const nextChain = cloneChain(chain);
    const b = nextChain[selBlock];
    const lastTx = b.txs[b.txs.length - 1];
    lastTx.ts -= 864e5;
    b.merkle = await merkleRoot(b.txs);
    b.hash = await blockHash(b);
    setChain(nextChain);
    persistAll(nextChain, pool, wallets);
    await runValidation(nextChain, false);
  }, [chain, selBlock, pool, wallets, persistAll, runValidation]);

  const handleRestore = useCallback(async () => {
    const raw = window.localStorage.getItem(LS.snap);
    if (!raw) return;
    const restored = JSON.parse(raw) as LedgerBlock[];
    window.localStorage.removeItem(LS.snap);
    setHasSnapshot(false);
    setChain(restored);
    persistAll(restored, pool, wallets);
    await runValidation(restored, true);
    playCue("verify");
    pushToast("Original ledger restored");
  }, [pool, wallets, persistAll, runValidation, playCue, pushToast]);

  const handleReset = useCallback(() => {
    if (!window.confirm("Erase this browser's ledger and wallets and start over?")) return;
    Object.values(LS).forEach((k) => window.localStorage.removeItem(k));
    window.location.reload();
  }, []);

  const flashSpotlight = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.classList.remove("co-spotlight");
    void el.offsetWidth;
    el.classList.add("co-spotlight");
    window.setTimeout(() => el.classList.remove("co-spotlight"), 1400);
  }, []);

  const locateSection = useCallback(
    (section: SectionTarget) => {
      const id = section === "folio" ? "folio-showcase" : section;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashSpotlight(el);
    },
    [flashSpotlight],
  );

  const selectWalletAddress = useCallback((addr: string) => {
    setActiveAddr(addr);
    window.localStorage.setItem(LS.sel, addr);
  }, []);

  const openRegisterForm = useCallback(() => {
    const lib = wallets.find((w) => w.role === "librarian");
    if (lib && activeWallet?.address !== lib.address) {
      selectWalletAddress(lib.address);
    }
    setRegOpen(true);
    const panel = document.getElementById("desk-register");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      flashSpotlight(panel);
    } else {
      locateSection("desk");
    }
    window.setTimeout(() => regTitleRef.current?.focus(), 260);
  }, [wallets, activeWallet, selectWalletAddress, flashSpotlight, locateSection]);

  const allBooks = useMemo(() => [...libraryState.books.values()], [libraryState]);

  const selectedBlock = chain[selBlock] ?? null;
  const selectedValidation = report?.[selBlock] ?? null;

  return (
    <>
      <motion.div className="progress" style={{ scaleX: smoothProgress }} aria-hidden="true" />

      <header className="nav">
        <a className="logo" href="#top" aria-label="Colophon">
          <svg viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <rect x="1" y="8" width="6" height="17" fill="currentColor" />
            <rect x="9" y="2" width="6" height="23" fill="var(--brass)" />
            <rect x="17" y="11" width="6" height="14" fill="currentColor" />
          </svg>
          Colophon
        </a>

        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#principles">
            <TextRoll>Principles</TextRoll>
          </a>
          <a href="#protocol">
            <TextRoll>Protocol</TextRoll>
          </a>
          <a href="#desk">
            <TextRoll>Circulation desk</TextRoll>
          </a>
          <a href="#ledger">
            <TextRoll>Ledger</TextRoll>
          </a>
        </nav>

        <div className="nav-right">
          <DynamicStatusPill
            blockHeight={blockHeight}
            chainOK={chainOK}
            failedIndex={failedBlockIndex}
            pendingCount={pool.length}
            ready={ready}
            variant={transitionVariant}
            onVariantChange={setTransitionVariant}
          />
          <VolumeIcon muted={muted} onToggle={() => setMuted((m) => !m)} />
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
          <MenuIcon open={drawerOpen} onToggle={() => setDrawerOpen((v) => !v)} />
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="mobile-drawer"
          >
            {[
              { href: "#principles", label: "Principles" },
              { href: "#protocol", label: "Protocol" },
              { href: "#desk", label: "Circulation desk" },
              { href: "#ledger", label: "Ledger" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="mobile-drawer-link"
                onClick={() => setDrawerOpen(false)}
              >
                <TextRoll>{item.label}</TextRoll>
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">
                <span className="rule" />
                Library circulation on a shared ledger
              </p>
              <h1 className="display">
                <span className="ln">
                  <motion.span
                    className="ln"
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    A library that
                  </motion.span>
                </span>
                <span className="ln">
                  <motion.span
                    className="ln"
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.9, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    cannot be <em>quietly</em>
                  </motion.span>
                </span>
                <span className="ln">
                  <motion.span
                    className="ln"
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.9, delay: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    rewritten.
                  </motion.span>
                </span>
              </h1>
              <p className="lede">
                Every acquisition, loan and return is signed by the person who made it, sealed into
                a block, and chained to everything that came before. Nobody — not even the
                librarian — can edit the past.
              </p>
              <div className="hero-cta">
                <a className="btn" href="#desk">
                  Open the circulation desk
                  <ArrowIcon />
                </a>
                <a className="hero-cta-link" href="#protocol">
                  <TextRoll>How it works</TextRoll>
                </a>
              </div>
            </div>

            <div>
              <div className="shelf" aria-label="Collection bookshelf">
                {SHELF_SPINES.map((sp, i) => (
                  <motion.a
                    key={sp.title}
                    href="#desk"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    whileHover={{ y: -14 }}
                    transition={{ duration: 0.75, delay: 0.12 + i * 0.045, ease: [0.2, 0.8, 0.2, 1] }}
                    className={`spine${sp.lean ? " lean" : ""}`}
                    style={{
                      height: `${sp.heightPct}%`,
                      width: `${sp.widthPx}px`,
                      color: sp.fg,
                      background: `linear-gradient(to bottom,transparent 9%,rgba(176,138,62,.9) 9% 10.5%,transparent 10.5% 89.5%,rgba(176,138,62,.9) 89.5% 91%,transparent 91%),${sp.bg}`,
                    }}
                    title={sp.title}
                  >
                    <span>{sp.title}</span>
                  </motion.a>
                ))}
              </div>
              <div className="fig">
                <span>Fig. 1 — The collection</span>
                <span>as of block #{ready ? blockHeight : "—"}</span>
              </div>
            </div>
          </div>

          <div className="wrap">
            <dl className="hero-foot">
              <div>
                <dt>Chain height</dt>
                <dd>{ready ? `#${blockHeight}` : "—"}</dd>
              </div>
              <div>
                <dt>Latest block hash</dt>
                <dd>{latestBlock ? renderHashLeading(latestBlock.hash, 26) : "—"}</dd>
              </div>
              <div>
                <dt>Work target</dt>
                <dd>{latestBlock ? `${latestBlock.difficulty} leading zeros` : "—"}</dd>
              </div>
              <div>
                <dt>Awaiting seal</dt>
                <dd>
                  {pool.length} pending entr{pool.length === 1 ? "y" : "ies"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="marquee" aria-hidden="true">
            <div className="marquee-track">
              {[0, 1].map((half) => (
                <div key={half} className="marquee-half">
                  {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, idx) => (
                    <span key={`${half}-${idx}`} style={{ display: "contents" }}>
                      <span>{word}</span>
                      <i />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="section dark manifesto" id="principles">
          <div className="wrap">
            <p className="eyebrow" style={{ marginBottom: 44 }}>
              <span className="rule" />
              01 — Principles
            </p>
            <motion.p
              className="big"
              initial={{ opacity: 0.28, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.45 }}
              transition={{ duration: 0.7 }}
            >
              A library is a promise kept across generations. Colophon records every acquisition,
              loan and return as a signed entry in a shared ledger, so the history of a collection
              can be checked by anyone, and edited by no one.
            </motion.p>
            <div className="pillars">
              {[
                {
                  roman: "I.",
                  title: "Provenance",
                  copy: "Each volume carries its full chain of custody: registered by whom, lent to whom, returned when.",
                },
                {
                  roman: "II.",
                  title: "Accountability",
                  copy: "Loans are signed with the member's own key. A record cannot be disowned, and cannot be forged.",
                },
                {
                  roman: "III.",
                  title: "Continuity",
                  copy: "Because the ledger is verifiable by replay, the record outlives any single database, vendor or server.",
                },
              ].map((pillar, i) => (
                <motion.div
                  key={pillar.roman}
                  className="pillar"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.65, delay: i * 0.1 }}
                >
                  <motion.div
                    className="draw"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.9, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                  <small>{pillar.roman}</small>
                  <h4>{pillar.title}</h4>
                  <p>{pillar.copy}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PROTOCOL */}
        <section className="section" id="protocol">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">
                <span className="rule" />
                02 — Protocol
              </p>
              <h2 className="title">
                Four steps from <em>shelf</em> to <em>proof.</em>
              </h2>
              <p className="sub">
                The same mechanics that secure public blockchains, applied to the circulation desk.
                Everything below runs live on this page.
              </p>
            </div>

            <div className="stack">
              <article className="pcard" style={{ ["--i" as string]: 0 }}>
                <div className="pcard-in">
                  <div className="pc-l">
                    <span className="num">01</span>
                    <div>
                      <h3>Register</h3>
                      <p>
                        A librarian adds a volume. The entry is signed with an ECDSA key whose
                        address was granted authority in the genesis block.
                      </p>
                    </div>
                  </div>
                  <div className="pc-r">
                    <pre>
                      <span className="k">{"type    "}</span> REGISTER{"\n"}
                      <span className="k">{"book    "}</span> LB-0009{"\n"}
                      <span className="k">{"signer  "}</span>{" "}
                      <span className="h">0x7be1…c09a</span> (librarian){"\n"}
                      <span className="k">{"payload "}</span> {"{title, author, year, call}"}{"\n"}
                      <span className="k">{"sig     "}</span> ECDSA P-256 · SHA-256 · 64 bytes
                    </pre>
                  </div>
                </div>
              </article>

              <article className="pcard" style={{ ["--i" as string]: 1 }}>
                <div className="pcard-in">
                  <div className="pc-l">
                    <span className="num">02</span>
                    <div>
                      <h3>Borrow &amp; return</h3>
                      <p>
                        A member signs a checkout. Rules are enforced by every verifier: no double
                        loans, a three-volume limit, and only the borrower may return.
                      </p>
                    </div>
                  </div>
                  <div className="pc-r">
                    <pre>
                      <span className="k">{"type    "}</span> BORROW{"\n"}
                      <span className="k">{"book    "}</span> LB-0004{"\n"}
                      <span className="k">{"signer  "}</span>{" "}
                      <span className="h">0x41c9…77d2</span> (member){"\n"}
                      <span className="k">{"due     "}</span> ts + 14 days{"\n"}
                      <span className="k">{"state   "}</span> available → borrowed{"\n"}
                      <span className="k">{"status  "}</span> queued in mempool
                    </pre>
                  </div>
                </div>
              </article>

              <article className="pcard" style={{ ["--i" as string]: 2 }}>
                <div className="pcard-in">
                  <div className="pc-l">
                    <span className="num">03</span>
                    <div>
                      <h3>Seal</h3>
                      <p>
                        Pending entries are hashed into a Merkle tree. A miner searches for a nonce
                        until the block hash meets the work target, then links it to the previous
                        block.
                      </p>
                    </div>
                  </div>
                  <div className="pc-r">
                    <pre>
                      <span className="k">{"index   "}</span> 12{"\n"}
                      <span className="k">{"prev    "}</span>{" "}
                      <span className="h">000a91…e4</span>{"\n"}
                      <span className="k">{"merkle  "}</span> sha256(sha256(tx₁‖tx₂)‖…){"\n"}
                      <span className="k">{"nonce   "}</span> 7,412{"\n"}
                      <span className="k">{"hash    "}</span>{" "}
                      <span className="h">000</span>3f2b…19c0
                    </pre>
                  </div>
                </div>
              </article>

              <article className="pcard" style={{ ["--i" as string]: 3 }}>
                <div className="pcard-in">
                  <div className="pc-l">
                    <span className="num">04</span>
                    <div>
                      <h3>Verify</h3>
                      <p>
                        Anyone can replay the chain from block zero: recompute every hash, check
                        every signature, re-apply every rule. Change one byte and the proof
                        collapses.
                      </p>
                    </div>
                  </div>
                  <div className="pc-r">
                    <pre>
                      <span className="k">{"links   "}</span> ✓ prev-hash chain{"\n"}
                      <span className="k">{"merkle  "}</span> ✓ roots recomputed{"\n"}
                      <span className="k">{"work    "}</span> ✓ targets met{"\n"}
                      <span className="k">{"sigs    "}</span> ✓ all signatures valid{"\n"}
                      <span className="k">{"rules   "}</span> ✓ state replay clean
                    </pre>
                  </div>
                </div>
              </article>
            </div>

            <div id="folio-showcase">
              <ColophonShowcase chainHeight={blockHeight} pendingCount={pool.length} />
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="wrap" style={{ paddingBottom: "clamp(80px,11vw,150px)" }}>
          <div className="stats" id="stats">
            <div className="stat">
              <b>
                <AnimatedNumber value={chain.length} />
              </b>
              <span>Blocks sealed</span>
            </div>
            <div className="stat">
              <b>
                <AnimatedNumber value={totalTxCount} />
              </b>
              <span>Signed entries</span>
            </div>
            <div className="stat">
              <b>
                <AnimatedNumber value={libraryState.books.size} />
              </b>
              <span>Volumes catalogued</span>
            </div>
            <div className="stat">
              <b>
                <AnimatedNumber value={hashesComputed} />
              </b>
              <span>Hashes computed here</span>
            </div>
          </div>
        </section>

        {/* CIRCULATION DESK */}
        <section className="section" id="desk" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">
                <span className="rule" />
                03 — Circulation desk
              </p>
              <h2 className="title">
                Check a volume out. Watch it enter the <em>ledger.</em>
              </h2>
              <p className="sub">
                Choose a wallet, borrow or return a volume, then seal your pending entries into a
                block. Your keys are generated and stored in this browser only.
              </p>
            </div>

            <div className="desk-grid">
              <div>
                <div className="cat-bar">
                  <h3>Catalogue</h3>
                  <SmoothInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onClear={() => setQuery("")}
                    placeholder="Search title, author, ID"
                    aria-label="Search library catalogue"
                  />
                  <div className="filters" role="group" aria-label="Filter catalogue">
                    {(["all", "available", "borrowed"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={filter === key ? "on" : undefined}
                        onClick={() => setFilter(key)}
                      >
                        {key === "all" ? "All" : key === "available" ? "Available" : "On loan"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  {bootError ? (
                    <p className="empty">Could not start the ledger: {bootError}</p>
                  ) : !ready ? (
                    <p className="empty">{bootMessage}</p>
                  ) : filteredBooks.length === 0 ? (
                    <p className="empty">No volumes match.</p>
                  ) : (
                    filteredBooks.map((book) => {
                      const lastHist = book.history[book.history.length - 1];
                      const isPending = lastHist?.where === "pending";
                      const isOpen = Boolean(openRows[book.id]);
                      const isHolder = Boolean(activeWallet && book.holder === activeWallet.address);

                      return (
                        <article key={book.id} className={`row${isOpen ? " open" : ""}`}>
                          <div className="row-id">{book.id}</div>
                          <div>
                            <h4>{book.title}</h4>
                            <p>
                              {book.author}, {book.year} · {book.call}
                            </p>
                          </div>
                          <div className="row-st">
                            {book.status === "available" ? (
                              <span className="tag av">Available</span>
                            ) : (
                              <>
                                <span className="tag ln">On loan</span>
                                <span className="tag due">
                                  {nameOf(book.holder)} · due{" "}
                                  {book.due ? fmtDate(book.due) : "—"}
                                </span>
                              </>
                            )}
                            {isPending && <span className="tag pe">Pending seal</span>}
                          </div>
                          <div className="row-act">
                            {book.status === "available" && (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => void queueTx({ type: "BORROW", bookId: book.id })}
                              >
                                Borrow
                              </button>
                            )}
                            {book.status === "borrowed" && isHolder && (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => void queueTx({ type: "RETURN", bookId: book.id })}
                              >
                                Return
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn sm ghost"
                              onClick={() =>
                                setOpenRows((prev) => ({ ...prev, [book.id]: !prev[book.id] }))
                              }
                            >
                              Provenance
                            </button>
                          </div>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.76, 0, 0.24, 1] }}
                                className="hist"
                              >
                                <FadeScrollArea maxHeight={180} ariaLabel={`Provenance of ${book.title}`}>
                                  <ol>
                                    {book.history.map((h, idx) => (
                                      <li key={`${h.type}-${h.ts}-${idx}`}>
                                        <span>
                                          {h.where === "pending" ? "pending" : `block #${h.where}`}
                                        </span>{" "}
                                        &nbsp;{h.type} · {nameOf(h.from)} · {fmtDate(h.ts)}
                                      </li>
                                    ))}
                                  </ol>
                                </FadeScrollArea>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>

              <aside className="side">
                <div className="panel">
                  <h5>
                    <span>Signing as</span>
                    <span>{activeWallet?.role ?? "—"}</span>
                  </h5>
                  <div className="sel-wrap">
                    <select
                      aria-label="Active wallet"
                      value={activeWallet?.address ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setActiveAddr(next);
                        window.localStorage.setItem(LS.sel, next);
                      }}
                    >
                      {wallets.map((w) => (
                        <option key={w.address} value={w.address}>
                          {w.name} — {w.role}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeWallet && (
                    <dl className="wmeta">
                      <dt>address</dt>
                      <dd>{shortHash(activeWallet.address, 10, 6)}</dd>
                      <dt>curve</dt>
                      <dd>ECDSA P-256</dd>
                      <dt>loans</dt>
                      <dd>
                        {activeLoansCount} / {MAX_LOANS}
                      </dd>
                    </dl>
                  )}
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void handleCreateMember()}
                  >
                    + New member wallet
                  </button>
                </div>

                <div className="panel" id="desk-register">
                  <details
                    open={regOpen}
                    onToggle={(e) => setRegOpen((e.currentTarget as HTMLDetailsElement).open)}
                  >
                    <summary>
                      <span>Register a volume</span>
                      <span>{regOpen ? "−" : "+"}</span>
                    </summary>
                    <div className="stack-in">
                      <input
                        ref={regTitleRef}
                        placeholder="Title"
                        value={rTitle}
                        disabled={activeWallet?.role !== "librarian"}
                        onChange={(e) => setRTitle(e.target.value)}
                      />
                      <input
                        placeholder="Author"
                        value={rAuthor}
                        disabled={activeWallet?.role !== "librarian"}
                        onChange={(e) => setRAuthor(e.target.value)}
                      />
                      <div className="two">
                        <input
                          placeholder="Call no."
                          value={rCall}
                          disabled={activeWallet?.role !== "librarian"}
                          onChange={(e) => setRCall(e.target.value)}
                        />
                        <input
                          placeholder="Year"
                          inputMode="numeric"
                          value={rYear}
                          disabled={activeWallet?.role !== "librarian"}
                          onChange={(e) => setRYear(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={activeWallet?.role !== "librarian"}
                        onClick={() => void handleRegisterVolume()}
                      >
                        Sign &amp; queue
                      </button>
                      {activeWallet?.role !== "librarian" && (
                        <p className="pool-empty">
                          Switch to the librarian wallet to register volumes.
                        </p>
                      )}
                    </div>
                  </details>
                </div>

                <div className="panel">
                  <h5>
                    <span>Mempool</span>
                    <span>{pool.length}</span>
                  </h5>
                  <FadeScrollArea maxHeight={156} ariaLabel="Pending mempool transactions">
                    {pool.length === 0 ? (
                      <p className="pool-empty" style={{ marginTop: 0 }}>
                        No pending entries.
                      </p>
                    ) : (
                      <ul className="pool">
                        {pool.map((tx, idx) => (
                          <li key={`${tx.sig}-${idx}`}>
                            <b>{tx.type}</b>
                            <span>
                              {tx.bookId} · {nameOf(tx.from)}
                            </span>
                            <span title="signature">✓ {shortHash(tx.sig, 4, 2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </FadeScrollArea>

                  <div className="mine-row">
                    <select
                      aria-label="Proof-of-work difficulty"
                      title="Difficulty (leading zero hex digits)"
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                    >
                      <option value={2}>d=2</option>
                      <option value={3}>d=3</option>
                      <option value={4}>d=4</option>
                    </select>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busyMining}
                      onClick={() => void handleMine()}
                    >
                      {busyMining ? "Sealing…" : "Seal block"}
                    </button>
                  </div>
                  <div className="mine-out">{mineOutput}</div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* LEDGER */}
        <section className="section dark" id="ledger">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">
                <span className="rule" />
                04 — Ledger
              </p>
              <h2 className="title">
                Every block, <em>open to inspection.</em>
              </h2>
              <p className="sub">
                Select a block to read it. Then try to cheat: backdate a record and see how the
                chain reacts, even when the forger recalculates the hashes.
              </p>
            </div>

            <div className="ledger-tools">
              <button
                type="button"
                className="btn sm"
                onClick={() => void runValidation(chain, false)}
              >
                Verify entire chain
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => void handleTamper()}
              >
                Backdate a record in selected block
              </button>
              {hasSnapshot && (
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => void handleRestore()}
                >
                  Restore original
                </button>
              )}
              <button type="button" className="btn sm ghost" onClick={handleReset}>
                Reset ledger
              </button>
            </div>

            <div
              ref={chainRef}
              className="chain"
              onPointerDown={(e) => {
                if (!chainRef.current) return;
                dragState.current = {
                  active: true,
                  moved: false,
                  startX: e.clientX,
                  startLeft: chainRef.current.scrollLeft,
                };
              }}
              onPointerMove={(e) => {
                const st = dragState.current;
                if (!st.active || !chainRef.current) return;
                const dx = e.clientX - st.startX;
                if (Math.abs(dx) > 4) {
                  st.moved = true;
                  chainRef.current.classList.add("drag");
                }
                chainRef.current.scrollLeft = st.startLeft - dx;
              }}
              onPointerUp={() => {
                dragState.current.active = false;
                chainRef.current?.classList.remove("drag");
                window.setTimeout(() => {
                  dragState.current.moved = false;
                }, 0);
              }}
              onPointerLeave={() => {
                dragState.current.active = false;
                chainRef.current?.classList.remove("drag");
              }}
            >
              {chain.map((b, i) => {
                const val = report?.[i];
                const bad = Boolean(val && !val.ok);
                const linkBad = Boolean(
                  val?.reasons.some((reason) => reason.startsWith("Previous-hash")),
                );
                return (
                  <span key={b.index} style={{ display: "contents" }}>
                    {i > 0 && <span className={`conn${linkBad ? " bad" : ""}`} />}
                    <button
                      type="button"
                      onClick={() => {
                        if (dragState.current.moved) return;
                        setSelBlock(i);
                      }}
                      className={`blk${i === selBlock ? " sel" : ""}${bad ? " bad" : ""}`}
                    >
                      <span className="blk-top">
                        <span>Block {String(i).padStart(3, "0")}</span>
                        <span className="st">{bad ? "Invalid" : "Valid"}</span>
                      </span>
                      <span className="blk-hash">{renderHashLeading(b.hash, 22)}</span>
                      <span className="blk-meta">
                        <span>prev</span>
                        <span>{shortHash(b.prev, 8, 4)}</span>
                        <span>entries</span>
                        <span>{b.txs.length}</span>
                        <span>nonce</span>
                        <span>{b.nonce.toLocaleString("en-US")}</span>
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>

            {selectedBlock && (
              <div className="detail">
                <div>
                  <h4>Block {selBlock}</h4>
                  <dl className="kv">
                    <dt>sealed</dt>
                    <dd>{fmtTime(selectedBlock.ts)}</dd>
                    <dt>previous</dt>
                    <dd>{selectedBlock.prev}</dd>
                    <dt>merkle root</dt>
                    <dd>{selectedBlock.merkle}</dd>
                    <dt>difficulty</dt>
                    <dd>{selectedBlock.difficulty} leading zeros</dd>
                    <dt>nonce</dt>
                    <dd>
                      {selectedBlock.nonce.toLocaleString("en-US")}
                      {selectedBlock.attempts ? ` · ${selectedBlock.ms} ms` : ""}
                    </dd>
                    <dt>hash</dt>
                    <dd>{renderHashLeading(selectedBlock.hash)}</dd>
                  </dl>
                  {selectedValidation && !selectedValidation.ok && (
                    <ul className="reasons">
                      {selectedValidation.reasons.map((reason) => (
                        <li key={reason}>× {reason}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4>
                    {selectedBlock.txs.length} signed entr
                    {selectedBlock.txs.length === 1 ? "y" : "ies"}
                  </h4>
                  <FadeScrollArea maxHeight={300} ariaLabel={`Signed entries in block ${selBlock}`}>
                    <ul className="txl">
                      {selectedBlock.txs.map((t, idx) => (
                        <li key={`${t.type}-${t.ts}-${idx}`}>
                          <b>{t.type}</b>
                          <span style={{ opacity: 1 }}>
                            {t.bookId ||
                              `authority → ${shortHash(
                                (t.data as GenesisPayload | null)?.librarian,
                                8,
                                4,
                              )}`}
                          </span>
                          <span>
                            {t.type === "GENESIS"
                              ? "protocol"
                              : `${nameOf(t.from)} · sig ${shortHash(t.sig, 8, 4)}`}
                          </span>
                          <span>{fmtTime(t.ts)}</span>
                        </li>
                      ))}
                    </ul>
                  </FadeScrollArea>
                </div>
              </div>
            )}

            {report && (
              <div className="report">
                <p>
                  {chainOK
                    ? "Chain verified — every link, Merkle root, work target, signature and rule checks out."
                    : "Verification failed. The ledger no longer proves its own history."}
                </p>
                <ul>
                  {report.map((r) => (
                    <li key={r.index} className={r.ok ? "ok" : "no"}>
                      {r.ok ? "✓" : "×"} block {String(r.index).padStart(3, "0")}
                      {r.ok ? "" : ` — ${r.reasons[0]}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-top">
            <div>
              <h6>Colophon</h6>
              <p>
                A reference implementation of library circulation on a hash-linked, signed,
                proof-of-work ledger.
              </p>
            </div>
            <div>
              <h6>Under the hood</h6>
              <ul>
                <li>SHA-256 block &amp; transaction hashing</li>
                <li>ECDSA P-256 wallet signatures</li>
                <li>Merkle roots · proof-of-work</li>
                <li>Deterministic state replay</li>
              </ul>
            </div>
            <div>
              <h6>A note on scope</h6>
              <p>
                This page simulates a single node in your browser. A production deployment would
                replicate the ledger across institutions, for example on a permissioned network.
              </p>
            </div>
          </div>

          <div className="wordmark" aria-label="Colophon">
            {"Colophon".split("").map((char, idx) => (
              <span key={idx} className="ch">
                <motion.span
                  style={{ display: "inline-block" }}
                  initial={{ y: "105%" }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.8, delay: idx * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {char}
                </motion.span>
              </span>
            ))}
          </div>

          <div className="legal">
            <span>© Colophon Ledger — demonstration build</span>
            <span>Data stored locally in your browser</span>
          </div>
        </div>
      </footer>

      <ColophonNavigatorAI
        ready={ready}
        chain={chain}
        pool={pool}
        wallets={wallets}
        activeWallet={activeWallet}
        books={allBooks}
        chainOK={chainOK}
        failedBlockIndex={failedBlockIndex}
        hasSnapshot={hasSnapshot}
        busyMining={busyMining}
        theme={theme}
        onLocateSection={locateSection}
        onSearchBook={setQuery}
        onFilterBooks={setFilter}
        onBorrowBook={(bookId) => queueTx({ type: "BORROW", bookId })}
        onReturnBook={(bookId) => queueTx({ type: "RETURN", bookId })}
        onOpenProvenance={(bookId) => {
          setOpenRows((prev) => ({ ...prev, [bookId]: true }));
          locateSection("desk");
        }}
        onMine={handleMine}
        onSelectWallet={selectWalletAddress}
        onCreateMember={handleCreateMember}
        onOpenRegisterForm={openRegisterForm}
        onSelectBlock={setSelBlock}
        onVerifyChain={() => runValidation(chain, false)}
        onTamper={handleTamper}
        onRestore={handleRestore}
        onToggleTheme={toggleTheme}
      />

      <div className="toast" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className={`toast-item${t.kind === "err" ? " err" : ""}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
