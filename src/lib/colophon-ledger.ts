export const LOAN_DAYS = 14;
export const MAX_LOANS = 3;
export const MIN_DIFF = 2;
export const ZERO = "0".repeat(64);

export const LS = {
  chain: "colophon.chain.v1",
  pool: "colophon.pool.v1",
  wallets: "colophon.wallets.v1",
  snap: "colophon.snap.v1",
  sel: "colophon.sel.v1",
} as const;

export type WalletRole = "librarian" | "member";

export interface WalletPub {
  x: string;
  y: string;
}

export interface Wallet {
  name: string;
  role: WalletRole;
  pub: WalletPub;
  priv: JsonWebKey;
  address: string;
}

export type TxType = "GENESIS" | "REGISTER" | "BORROW" | "RETURN";

export interface BookPayload {
  title: string;
  author: string;
  year: number;
  call: string;
}

export interface GenesisPayload {
  librarian: string;
  note: string;
}

export interface LedgerTx {
  type: TxType;
  from: string;
  pub: WalletPub | null;
  ts: number;
  bookId: string | null;
  data: BookPayload | GenesisPayload | null;
  sig: string;
}

export interface LedgerBlock {
  index: number;
  ts: number;
  prev: string;
  merkle: string;
  difficulty: number;
  nonce: number;
  hash: string;
  txs: LedgerTx[];
  ms?: number;
  attempts?: number;
}

export interface BookHistoryItem {
  type: TxType;
  from: string;
  ts: number;
  where: number | "pending";
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  year: number;
  call: string;
  status: "available" | "borrowed";
  holder: string | null;
  due: number | null;
  history: BookHistoryItem[];
}

export interface LibraryState {
  librarians: Set<string>;
  books: Map<string, BookRecord>;
}

export interface ValidationEntry {
  index: number;
  ok: boolean;
  reasons: string[];
}

export const SEED: readonly [string, string, number, string][] = [
  ["Ficciones", "Jorge Luis Borges", 1944, "863 BOR"],
  ["Invisible Cities", "Italo Calvino", 1972, "853 CAL"],
  ["Gödel, Escher, Bach", "Douglas Hofstadter", 1979, "153 HOF"],
  ["The Mythical Man-Month", "Frederick P. Brooks", 1975, "005.1 BRO"],
  ["A Pattern Language", "Christopher Alexander", 1977, "721 ALE"],
  ["The Design of Everyday Things", "Don Norman", 1988, "745 NOR"],
  ["The Structure of Scientific Revolutions", "Thomas S. Kuhn", 1962, "501 KUH"],
  ["Mastering Bitcoin", "Andreas Antonopoulos", 2014, "332 ANT"],
];

export const SHELF_SPINES: readonly {
  title: string;
  heightPct: number;
  widthPx: number;
  bg: string;
  fg: string;
  lean?: boolean;
}[] = [
  { title: "Ficciones", heightPct: 78, widthPx: 40, bg: "#1B3832", fg: "#EEEADF" },
  { title: "Invisible Cities", heightPct: 92, widthPx: 34, bg: "#B08A3E", fg: "#121C1A" },
  { title: "A Pattern Language", heightPct: 66, widthPx: 52, bg: "#121C1A", fg: "#EEEADF" },
  { title: "Mastering Bitcoin", heightPct: 84, widthPx: 36, bg: "#A2452F", fg: "#EEEADF" },
  { title: "Gödel, Escher, Bach", heightPct: 96, widthPx: 46, bg: "#D2CBB6", fg: "#121C1A" },
  { title: "The Mythical Man-Month", heightPct: 72, widthPx: 38, bg: "#24473F", fg: "#EEEADF" },
  {
    title: "Structure of Scientific Revolutions",
    heightPct: 88,
    widthPx: 44,
    bg: "#7C8F85",
    fg: "#121C1A",
  },
  {
    title: "Design of Everyday Things",
    heightPct: 62,
    widthPx: 34,
    bg: "#22343F",
    fg: "#EEEADF",
    lean: true,
  },
  { title: "Colophon", heightPct: 80, widthPx: 30, bg: "#B08A3E", fg: "#121C1A" },
];

const enc = new TextEncoder();
let hashCount = 0;

export function getHashCount(): number {
  return hashCount;
}

export function resetHashCount(): void {
  hashCount = 0;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(s: string): Promise<string> {
  hashCount += 1;
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export function shortHash(h: string | null | undefined, a = 6, b = 4): string {
  if (!h) return "";
  return h.length > a + b + 1 ? `${h.slice(0, a)}…${h.slice(-b)}` : h;
}

export function leadingZeros(h: string): number {
  const m = h.match(/^0*/);
  return m ? m[0].length : 0;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export async function addrFrom(pub: WalletPub): Promise<string> {
  return "0x" + (await sha256(`${pub.x}.${pub.y}`)).slice(0, 40);
}

export async function newWallet(name: string, role: WalletRole): Promise<Wallet> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pubJ = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const pub: WalletPub = { x: pubJ.x ?? "", y: pubJ.y ?? "" };
  return { name, role, pub, priv, address: await addrFrom(pub) };
}

function txPayload(t: {
  type: TxType;
  from: string;
  ts: number;
  bookId: string | null;
  data: BookPayload | GenesisPayload | null;
}): string {
  return JSON.stringify({
    type: t.type,
    from: t.from,
    ts: t.ts,
    bookId: t.bookId,
    data: t.data,
  });
}

export async function signTx(
  wallet: Wallet,
  p: {
    type: TxType;
    ts?: number;
    bookId: string | null;
    data?: BookPayload | GenesisPayload | null;
  },
): Promise<LedgerTx> {
  const key = await crypto.subtle.importKey(
    "jwk",
    wallet.priv,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const tx: LedgerTx = {
    type: p.type,
    from: wallet.address,
    pub: wallet.pub,
    ts: p.ts ?? Date.now(),
    bookId: p.bookId,
    data: p.data ?? null,
    sig: "",
  };
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(txPayload(tx)),
  );
  tx.sig = toHex(signature);
  return tx;
}

export async function verifyTx(tx: LedgerTx): Promise<boolean> {
  if (tx.type === "GENESIS") return true;
  try {
    if (!tx.pub || (await addrFrom(tx.pub)) !== tx.from) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: tx.pub.x, y: tx.pub.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const bytes = tx.sig.match(/../g);
    if (!bytes) return false;
    const sig = new Uint8Array(bytes.map((h) => parseInt(h, 16)));
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      enc.encode(txPayload(tx)),
    );
  } catch {
    return false;
  }
}

function txCanon(tx: LedgerTx): string {
  return JSON.stringify([
    tx.type,
    tx.from,
    tx.pub ? tx.pub.x + tx.pub.y : "",
    tx.ts,
    tx.bookId,
    tx.data,
    tx.sig,
  ]);
}

function txHash(tx: LedgerTx): Promise<string> {
  return sha256(txCanon(tx));
}

export async function merkleRoot(txs: LedgerTx[]): Promise<string> {
  if (!txs.length) return ZERO;
  let level = await Promise.all(txs.map(txHash));
  while (level.length > 1) {
    if (level.length % 2) level.push(level[level.length - 1]);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(await sha256(level[i] + level[i + 1]));
    }
    level = next;
  }
  return level[0];
}

export function blockHash(b: {
  index: number;
  ts: number;
  prev: string;
  merkle: string;
  difficulty: number;
  nonce: number;
}): Promise<string> {
  return sha256([b.index, b.ts, b.prev, b.merkle, b.difficulty, b.nonce].join("|"));
}

export async function mineBlock(
  index: number,
  prev: string,
  txs: LedgerTx[],
  difficulty: number,
  onProgress?: (nonce: number, hash: string) => void,
): Promise<LedgerBlock> {
  const merkle = await merkleRoot(txs);
  const ts = Date.now();
  const target = "0".repeat(difficulty);
  const t0 = performance.now();
  let nonce = 0;

  for (;;) {
    const b = { index, ts, prev, merkle, difficulty, nonce };
    const hash = await blockHash(b);
    if (hash.startsWith(target)) {
      return {
        ...b,
        hash,
        txs,
        ms: Math.round(performance.now() - t0),
        attempts: nonce + 1,
      };
    }
    nonce += 1;
    if (nonce % 350 === 0) {
      onProgress?.(nonce, hash);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

export function freshState(): LibraryState {
  return { librarians: new Set(), books: new Map() };
}

export function applyTx(
  st: LibraryState,
  tx: LedgerTx,
  where: number | "pending",
): string | null {
  const rec: BookHistoryItem = { type: tx.type, from: tx.from, ts: tx.ts, where };
  if (tx.type === "GENESIS") {
    const data = tx.data as GenesisPayload | null;
    if (data?.librarian) st.librarians.add(data.librarian);
    return null;
  }
  if (tx.type === "REGISTER") {
    if (!st.librarians.has(tx.from)) return "Only a librarian may register volumes.";
    if (!tx.bookId || st.books.has(tx.bookId)) return "Volume ID already registered.";
    const data = tx.data as BookPayload;
    st.books.set(tx.bookId, {
      id: tx.bookId,
      title: data.title,
      author: data.author,
      year: data.year,
      call: data.call,
      status: "available",
      holder: null,
      due: null,
      history: [rec],
    });
    return null;
  }
  const b = tx.bookId ? st.books.get(tx.bookId) : undefined;
  if (!b) return "Unknown volume.";
  if (tx.type === "BORROW") {
    if (b.status !== "available") return "That volume is already on loan.";
    const count = [...st.books.values()].filter((x) => x.holder === tx.from).length;
    if (count >= MAX_LOANS) return `Loan limit reached (${MAX_LOANS} volumes).`;
    b.status = "borrowed";
    b.holder = tx.from;
    b.due = tx.ts + LOAN_DAYS * 864e5;
    b.history.push(rec);
    return null;
  }
  if (tx.type === "RETURN") {
    if (b.status !== "borrowed") return "That volume is not on loan.";
    if (b.holder !== tx.from) return "Only the borrower may return this volume.";
    b.status = "available";
    b.holder = null;
    b.due = null;
    b.history.push(rec);
    return null;
  }
  return "Unknown transaction type.";
}

export function computeState(
  chain: LedgerBlock[],
  pool: LedgerTx[],
  withPool: boolean,
): LibraryState {
  const st = freshState();
  chain.forEach((b, i) => b.txs.forEach((tx) => applyTx(st, tx, i)));
  if (withPool) {
    pool.forEach((tx) => applyTx(st, tx, "pending"));
  }
  return st;
}

export async function validateChain(ch: LedgerBlock[]): Promise<ValidationEntry[]> {
  const st = freshState();
  const out: ValidationEntry[] = [];
  let prevHash = ZERO;

  for (let i = 0; i < ch.length; i += 1) {
    const b = ch[i];
    const why = new Set<string>();
    if (b.index !== i) why.add("Index out of sequence");
    if (b.prev !== prevHash) why.add("Previous-hash link broken");
    if ((await merkleRoot(b.txs)) !== b.merkle) why.add("Merkle root ≠ transactions");
    if ((await blockHash(b)) !== b.hash) why.add("Stored hash ≠ header hash");
    if (!b.hash.startsWith("0".repeat(Math.max(b.difficulty, MIN_DIFF)))) {
      why.add("Proof-of-work target not met");
    }
    for (const tx of b.txs) {
      if (!(await verifyTx(tx))) {
        why.add(`Invalid signature on ${tx.type}${tx.bookId ? ` ${tx.bookId}` : ""}`);
      } else {
        const err = applyTx(st, tx, i);
        if (err) why.add(`Rule violation: ${err}`);
      }
    }
    out.push({ index: i, ok: why.size === 0, reasons: [...why] });
    prevHash = b.hash;
  }

  return out;
}

export async function bootstrapLedger(
  onProgress?: (attempts: number) => void,
): Promise<{ wallets: Wallet[]; chain: LedgerBlock[]; pool: LedgerTx[] }> {
  const lib = await newWallet("Librarian", "librarian");
  const mem = await newWallet("Member 01", "member");
  const wallets = [lib, mem];
  const g: LedgerTx = {
    type: "GENESIS",
    from: "protocol",
    pub: null,
    ts: Date.now(),
    bookId: null,
    data: {
      librarian: lib.address,
      note: "Authority granted to the founding librarian",
    },
    sig: "",
  };
  const txs: LedgerTx[] = [g];
  for (let i = 0; i < SEED.length; i += 1) {
    const [title, author, year, call] = SEED[i];
    txs.push(
      await signTx(lib, {
        type: "REGISTER",
        bookId: `LB-${String(i + 1).padStart(4, "0")}`,
        data: { title, author, year, call },
      }),
    );
  }
  const blk = await mineBlock(0, ZERO, txs, 3, (n) => onProgress?.(n));
  return { wallets, chain: [blk], pool: [] };
}

export function cloneChain(chain: LedgerBlock[]): LedgerBlock[] {
  return JSON.parse(JSON.stringify(chain)) as LedgerBlock[];
}
