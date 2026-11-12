"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { SpringCursorGlow } from "@/components/SpringCursorGlow";

type BindingFinish = {
  name: string;
  body: string;
  edge: string;
  text: string;
  rule: string;
};

type ProtocolFeature = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  details: string;
  specimen: string[];
};

const FINISHES: BindingFinish[] = [
  {
    name: "Forest Buckram",
    body: "#1B3832",
    edge: "#B08A3E",
    text: "#EEEADF",
    rule: "rgba(238,234,223,0.22)",
  },
  {
    name: "Rag Paper",
    body: "#E3DECF",
    edge: "#121C1A",
    text: "#121C1A",
    rule: "rgba(18,28,26,0.2)",
  },
  {
    name: "Burnished Brass",
    body: "#B08A3E",
    edge: "#121C1A",
    text: "#121C1A",
    rule: "rgba(18,28,26,0.26)",
  },
  {
    name: "Oxide Cloth",
    body: "#A2452F",
    edge: "#B08A3E",
    text: "#EEEADF",
    rule: "rgba(238,234,223,0.26)",
  },
];

const FEATURES: ProtocolFeature[] = [
  {
    id: "signatures",
    eyebrow: "01 · Keypairs",
    title: "Signed in browser with ECDSA P-256.",
    summary: "Every wallet derives its address by SHA-256 hashing its public JWK curve coordinates.",
    details:
      "Private keys are generated via window.crypto.subtle and exported locally as JWK records. No custody server ever handles signing material; librarians sign genesis-authorized registrations while members sign their own loans and returns.",
    specimen: ["curve   ECDSA P-256", "hash    SHA-256", "addr    0x + sha256(x.y)[:40]", "custody browser storage"],
  },
  {
    id: "merkle",
    eyebrow: "02 · Merkle Seal",
    title: "Entries fold into one binary root.",
    summary: "Canonical array digests pair recursively until every block header commits to one hash.",
    details:
      "If a block contains an odd number of transactions, the final digest is duplicated cleanly before pairing up the tree. Changing even a single millisecond timestamp in one entry alters the root all the way to the header.",
    specimen: ["leaf    sha256(txCanon)", "fold    pair(left + right)", "odd     duplicate tail leaf", "root    32-byte commitment"],
  },
  {
    id: "pow",
    eyebrow: "03 · Proof of Work",
    title: "Leading zero hex digits anchor time.",
    summary: "Miners iterate nonces asynchronously while streaming live attempt counts to the desk.",
    details:
      "Selectable difficulties d=2, d=3, or d=4 enforce genuine CPU work before a block can extend the chain. Because headers commit to prev, merkle, and ts, backdating an old block fails both PoW and prev-hash checks unless the entire tail is re-mined.",
    specimen: ["header  index|ts|prev|merkle", "target  0'.repeat(diff)", "yield   every 350 nonces", "min     d >= 2 enforced"],
  },
  {
    id: "replay",
    eyebrow: "04 · State Replay",
    title: "Deterministic rules rebuilt from #0.",
    summary: "Ownership, 14-day due dates, and the 3-book cap emerge solely from replaying blocks.",
    details:
      "Any node verifies integrity by wiping ephemeral memory and walking every block sequentially from genesis: confirming signatures, checking librarian authority, rejecting double loans, and catching any tampered timestamp or forged signature.",
    specimen: ["limit   3 volumes / member", "window  14 days from tx.ts", "return  holder === tx.from", "replay  genesis -> head"],
  },
];

const GAP = 16;

export function ColophonShowcase({
  chainHeight,
  pendingCount,
}: {
  chainHeight: number;
  pendingCount: number;
}) {
  const [finishIdx, setFinishIdx] = useState(0);
  const [index, setIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>("signatures");
  const [step, setStep] = useState(0);
  const [maxIndex, setMaxIndex] = useState(FEATURES.length - 1);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      const first = trackRef.current?.firstElementChild as HTMLElement | null;
      const viewport = viewportRef.current;
      if (!first || !viewport) return;
      const s = first.offsetWidth + GAP;
      const total = s * FEATURES.length - GAP;
      setStep(s);
      setMaxIndex(Math.max(0, Math.ceil((total - viewport.offsetWidth) / s)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const go = (next: number) => setIndex(Math.min(maxIndex, Math.max(0, next)));

  const onDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1);
  };

  const currentFinish = FINISHES[finishIdx];
  const activeFeature = FEATURES[index] ?? FEATURES[0];

  return (
    <SpringCursorGlow className="folio-showcase">
      <div className="folio-head">
        <div>
          <p className="eyebrow">
            <span className="rule" />
            Interactive archival folio
          </p>
          <h3 className="folio-title">
            Inspect the <em>binding</em> &amp; mechanics.
          </h3>
        </div>
        <p className="folio-sub">
          Choose an archival cloth finish, drag the cryptographic specimen track, or expand any stage to inspect exact verification invariants.
        </p>
      </div>

      <div className="folio-grid">
        {/* Left: Folio Binding Volume + Color Picker */}
        <div className="folio-stage">
          <motion.div
            className="folio-volume"
            animate={{
              backgroundColor: currentFinish.body,
              borderColor: currentFinish.edge,
              color: currentFinish.text,
              boxShadow: `0 28px 64px -24px ${currentFinish.edge}66`,
            }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            aria-label={`Archival folio bound in ${currentFinish.name}`}
          >
            <div className="folio-spine-groove" style={{ background: currentFinish.edge }} />
            <div className="folio-inner" style={{ borderColor: currentFinish.rule }}>
              <div className="folio-top-rule" style={{ borderColor: currentFinish.rule }}>
                <span className="mono">COLOPHON · #{chainHeight}</span>
                <span className="mono">{pendingCount} MEMPOOL</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.26 }}
                  className="folio-plate"
                >
                  <span className="folio-plate-eye mono" style={{ color: currentFinish.edge }}>
                    {activeFeature.eyebrow}
                  </span>
                  <h4 className="folio-plate-title">{activeFeature.title}</h4>
                  <ul className="folio-specimen" style={{ borderColor: currentFinish.rule }}>
                    {activeFeature.specimen.map((line) => (
                      <li key={line} className="mono">
                        {line}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>

              <div className="folio-foot-rule" style={{ borderColor: currentFinish.rule }}>
                <span className="mono">{currentFinish.name}</span>
                <span className="mono">P-256 · SHA-256</span>
              </div>
            </div>
          </motion.div>

          <div className="folio-swatches">
            <div className="folio-swatch-list" role="radiogroup" aria-label="Archival binding finish">
              {FINISHES.map((item, i) => {
                const selected = i === finishIdx;
                return (
                  <button
                    key={item.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={item.name}
                    onClick={() => setFinishIdx(i)}
                    className={`folio-swatch${selected ? " is-selected" : ""}`}
                    style={{ backgroundColor: item.body, borderColor: item.edge }}
                  />
                );
              })}
            </div>
            <span className="folio-swatch-name mono">{currentFinish.name}</span>
          </div>
        </div>

        {/* Right: Draggable Feature Carousel */}
        <div className="folio-carousel">
          <div ref={viewportRef} className="folio-viewport">
            <motion.div
              ref={trackRef}
              className="folio-track"
              drag="x"
              dragConstraints={{ left: -maxIndex * step, right: 0 }}
              dragElastic={0.14}
              onDragEnd={onDragEnd}
              animate={{ x: -index * step }}
              transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            >
              {FEATURES.map((f, i) => {
                const isOpen = openId === f.id;
                const isActive = i === index;
                return (
                  <motion.article
                    key={f.id}
                    layout
                    onClick={() => setIndex(i)}
                    className={`folio-card${isActive ? " is-active" : ""}`}
                  >
                    <div className="folio-card-top">
                      <div>
                        <p className="folio-card-eye mono">{f.eyebrow}</p>
                        <h4 className="folio-card-title">{f.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndex(i);
                          setOpenId(isOpen ? null : f.id);
                        }}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${f.eyebrow}` : `Expand ${f.eyebrow}`}
                        className="folio-plus-btn"
                      >
                        {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                      </button>
                    </div>
                    <p className="folio-card-sum">{f.summary}</p>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.76, 0, 0.24, 1] }}
                          className="folio-card-more"
                        >
                          <p>{f.details}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>

          <div className="folio-controls">
            <div className="folio-arrows">
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Previous stage"
                className="folio-nav-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                disabled={index === maxIndex}
                aria-label="Next stage"
                className="folio-nav-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="folio-dots" role="tablist" aria-label="Protocol stages">
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={f.eyebrow}
                  onClick={() => go(i)}
                  className={`folio-dot${i === index ? " is-active" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SpringCursorGlow>
  );
}
