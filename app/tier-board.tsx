'use client';

import { type DragEvent, type ReactNode, useEffect, useId, useReducer, useRef, useState } from 'react';
import { AppDialog, type DialogRequest } from '@/app/app-dialog';
import {
  type Action,
  type Category,
  type State,
  POOL,
  distribution,
  fillFor,
  initialState,
  hasItem,
  parseState,
  reducer,
} from '@/lib/tierlist';

/** Opens the in-app dialog; the id is filled in here so callers only describe what to ask. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type Ask = (request: DistributiveOmit<DialogRequest, 'id'>) => void;

export const STORAGE_KEY = 'tierlist:v1';

let fallbackId = 0;
export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${++fallbackId}`;

// Fixed ids for the first render so the static HTML and the client agree before storage loads.
function seedState(): State {
  let n = 0;
  return initialState(() => `seed-${++n}`);
}

export function loadSaved(storage: Pick<Storage, 'getItem'> | undefined): State | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? parseState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function persist(state: State) {
  try {
    const storage = safeStorage();
    if (!storage) return;
    // Write only when the categories changed. Switching tabs alone never rewrites storage, so a
    // stale tab cannot replace a newer board just by navigating, and synced tabs do not echo
    // each other's open-category choice back and forth.
    const stored = loadSaved(storage);
    if (stored && JSON.stringify(stored.categories) === JSON.stringify(state.categories)) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the board still works for this visit.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// edits counts category changes made in this tab. Each one is written exactly once, so a board
// loaded from storage or synced from another tab, or a later category switch, never rewrites it.
type Board = { state: State; hydrated: boolean; edits: number };
type BoardAction = Action | { type: 'hydrate'; saved: State | null } | { type: 'sync'; saved: State };

function boardReducer(b: Board, a: BoardAction): Board {
  if (a.type === 'hydrate') return { ...b, state: a.saved ?? b.state, hydrated: true };
  if (a.type === 'sync') {
    // Another tab saved: take its board but keep this tab's open category when it still exists.
    const keep = b.state.activeId === null || a.saved.categories.some((c) => c.id === b.state.activeId);
    return { ...b, state: keep ? { ...a.saved, activeId: b.state.activeId } : a.saved };
  }
  const state = reducer(b.state, a, newId);
  if (state === b.state) return b;
  // Opening another category is not an edit, so it never writes over a newer board.
  return { ...b, state, edits: state.categories === b.state.categories ? b.edits : b.edits + 1 };
}

export default function TierBoard({ initial }: { initial?: State }) {
  // hydrated lives in committed state, not a ref, so a Strict Mode effect replay before the
  // saved board is read can never write the seed board over it.
  const [board, dispatch] = useReducer(boardReducer, {
    state: initial ?? seedState(),
    hydrated: false,
    edits: 0,
  });
  const { state, hydrated, edits } = board;
  const savedEdits = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogCount = useRef(0);
  const [announcement, setAnnouncement] = useState('');
  const tabsRef = useRef<HTMLElement>(null);

  const ask: Ask = (request) => setDialog({ ...request, id: ++dialogCount.current } as DialogRequest);

  useEffect(() => {
    dispatch({ type: 'hydrate', saved: loadSaved(safeStorage()) });
    // Other tabs' saves arrive here, so a stale tab never writes an old board over a newer one.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      // Read what is stored now, not e.newValue: events can arrive late, after newer saves.
      const saved = loadSaved(safeStorage());
      if (saved) dispatch({ type: 'sync', saved });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated || edits === savedEdits.current) return;
    savedEdits.current = edits;
    persist(state);
  }, [state, hydrated, edits]);

  const active = state.categories.find((c) => c.id === state.activeId) ?? null;

  const go = (categoryId: string | null) => {
    setSelected(null);
    dispatch({ type: 'setActive', categoryId });
  };

  const addCategory = () =>
    ask({
      kind: 'prompt',
      title: 'สร้างหมวดใหม่',
      label: 'ชื่อหมวด เช่น หนัง, เกม, ร้านกาแฟ',
      confirmLabel: 'สร้างหมวด',
      onSubmit: (name) => {
        setSelected(null);
        dispatch({ type: 'addCategory', name });
      },
    });

  return (
    <div>
      <nav ref={tabsRef} aria-label="หมวด" className="flex flex-wrap gap-2">
        <TabButton current={state.activeId === null} onClick={() => go(null)}>
          ภาพรวม
        </TabButton>
        {state.categories.map((c) => (
          <TabButton key={c.id} current={state.activeId === c.id} onClick={() => go(c.id)}>
            {c.name}
          </TabButton>
        ))}
        <button type="button" className="btn btn-secondary shrink-0 whitespace-nowrap" onClick={addCategory}>
          + หมวดใหม่
        </button>
      </nav>

      <div className="mt-6">
        {active ? (
          <CategoryView
            key={active.id}
            category={active}
            dispatch={dispatch}
            selected={selected}
            setSelected={setSelected}
            ask={ask}
            announce={setAnnouncement}
          />
        ) : (
          <Overview categories={state.categories} onOpen={go} onAdd={addCategory} />
        )}
      </div>

      <BackupTools
        state={state}
        ask={ask}
        onImport={(s) => {
          setSelected(null);
          dispatch({ type: 'replace', state: s });
        }}
      />

      {/* Always mounted, so screen readers hear each move as it happens. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="board-announcer">
        {announcement}
      </div>

      <AppDialog
        request={dialog}
        onDone={() => setDialog(null)}
        fallbackFocus={() => tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')}
      />
    </div>
  );
}

function TabButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={`inline-flex min-h-11 max-w-full items-center rounded-2xl border px-4 py-1.5 text-left font-semibold wrap-anywhere ${
        current ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong bg-surface text-fg hover:bg-bg active:bg-border'
      }`}
    >
      {children}
    </button>
  );
}

type ViewProps = {
  category: Category;
  dispatch: (a: Action) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  ask: Ask;
  announce: (message: string) => void;
};

function CategoryView({ category: c, dispatch, selected, setSelected, ask, announce }: ViewProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItem = selected && hasItem(c, selected) ? c.items[selected] : undefined;

  const move = (itemId: string, to: string, index?: number) => {
    dispatch({ type: 'moveItem', categoryId: c.id, itemId, to, index });
    setSelected(null);
    const row = to === POOL ? 'ยังไม่จัด' : c.tiers.find((t) => t.id === to)?.label;
    if (row) announce(`ย้าย ${c.items[itemId].label} ไปแถว ${row} แล้ว`);
  };

  const add = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!draft.trim()) return;
    dispatch({ type: 'addItem', categoryId: c.id, label: draft });
    setDraft('');
    inputRef.current?.focus();
  };

  const rename = () =>
    ask({
      kind: 'prompt',
      title: 'แก้ชื่อหมวด',
      label: 'ชื่อหมวด',
      initial: c.name,
      onSubmit: (name) => dispatch({ type: 'renameCategory', categoryId: c.id, name }),
    });

  const remove = () =>
    ask({
      kind: 'confirm',
      title: `ลบหมวด "${c.name}"?`,
      message: 'ของทั้งหมดในหมวดนี้จะหายไปด้วย และย้อนกลับไม่ได้',
      confirmLabel: 'ลบหมวด',
      danger: true,
      onConfirm: () => {
        dispatch({ type: 'removeCategory', categoryId: c.id });
        announce(`ลบหมวด ${c.name} แล้ว`);
      },
    });

  const reset = () => {
    dispatch({ type: 'resetCategory', categoryId: c.id });
    announce('ย้ายของทุกชิ้นกลับไปแถว ยังไม่จัด แล้ว');
  };

  const rows = [
    ...c.tiers.map((t, i) => ({ id: t.id, label: t.label, ids: t.itemIds, fill: fillFor(t.label, i), tier: true })),
    { id: POOL, label: 'ยังไม่จัด', ids: c.pool, fill: 'var(--color-bg)', tier: false },
  ];

  return (
    <section aria-labelledby="category-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="category-title" className="min-w-0 font-serif text-2xl font-bold wrap-anywhere">{c.name}</h2>
        <CategoryMenu onRename={rename} onReset={reset} onRemove={remove} />
      </div>

      <p className="mt-2 text-sm text-fg-muted sm:text-base" id="board-help">
        แตะของหนึ่งชิ้นแล้วแตะ &quot;ย้ายมาที่นี่&quot; ในแถวที่ต้องการ หรือลากวางด้วยเมาส์ แตะชื่อแถวเพื่อแก้ชื่อ
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-border" aria-describedby="board-help">
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            category={c}
            selected={selected}
            onSelect={(id) => setSelected(selected === id ? null : id)}
            onMove={move}
            onRenameTier={
              row.tier
                ? () =>
                    ask({
                      kind: 'prompt',
                      title: `แก้ชื่อแถว ${row.label}`,
                      label: 'ชื่อแถว (ไม่เกิน 12 ตัวอักษร)',
                      initial: row.label,
                      maxLength: 12,
                      onSubmit: (label) => dispatch({ type: 'renameTier', categoryId: c.id, tierId: row.id, label }),
                    })
                : undefined
            }
          />
        ))}
      </div>

      {selectedItem && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-surface p-3" role="status">
          <span>
            เลือกอยู่: <strong>{selectedItem.label}</strong>
          </span>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              dispatch({ type: 'removeItem', categoryId: c.id, itemId: selectedItem.id });
              setSelected(null);
              announce(`ลบ ${selectedItem.label} แล้ว`);
            }}
          >
            ลบชิ้นนี้
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>ยกเลิก</button>
        </div>
      )}

      <form onSubmit={add} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">เพิ่มของในหมวดนี้</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            placeholder="เช่น ชื่อหนัง ชื่อร้าน"
            className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-fg"
          />
        </label>
        <button type="submit" className="btn btn-primary">เพิ่ม</button>
      </form>
    </section>
  );
}

type RowData = { id: string; label: string; ids: string[]; fill: string; tier: boolean };

function Row({
  row,
  category: c,
  selected,
  onSelect,
  onMove,
  onRenameTier,
}: {
  row: RowData;
  category: Category;
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (itemId: string, to: string, index?: number) => void;
  onRenameTier?: () => void;
}) {
  const [over, setOver] = useState(false);
  const canMoveHere = selected !== null && !row.ids.includes(selected);

  const drop = (e: DragEvent, index?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id && hasItem(c, id)) onMove(id, row.id, index);
  };

  return (
    <div
      className={`flex border-b border-border last:border-b-0 ${over ? 'bg-bg' : 'bg-surface'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => drop(e)}
    >
      <div
        className="flex w-20 shrink-0 items-center justify-center border-r border-border p-1 text-center font-bold sm:w-24"
        style={{ background: row.fill }}
      >
        {onRenameTier ? (
          <button
            type="button"
            onClick={onRenameTier}
            className="min-h-11 w-full rounded-md px-1 wrap-anywhere text-xl text-fg hover:bg-white/50 active:bg-white/70"
            aria-label={`แถว ${row.label} แตะเพื่อแก้ชื่อ`}
          >
            {row.label}
          </button>
        ) : (
          <span className="text-base font-semibold text-fg">{row.label}</span>
        )}
      </div>
      <ul className="flex min-h-16 min-w-0 flex-1 flex-wrap items-center gap-2 p-2" aria-label={`แถว ${row.label}`}>
        {row.ids.map((id, index) => {
          const item = c.items[id];
          const isSel = selected === id;
          return (
            <li key={id} onDrop={(e) => drop(e, index)}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                aria-pressed={isSel}
                onClick={() => onSelect(id)}
                className={`inline-flex min-h-11 max-w-full cursor-grab items-center rounded-md wrap-anywhere border px-3 text-left ${
                  isSel ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong bg-bg text-fg hover:border-accent active:bg-border'
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
        {canMoveHere && (
          <li>
            <button
              type="button"
              onClick={() => selected && onMove(selected, row.id)}
              className="inline-flex min-h-11 items-center rounded-md border border-dashed border-accent px-3 font-semibold text-accent hover:bg-bg active:bg-border"
            >
              ย้ายมาที่นี่
            </button>
          </li>
        )}
        {row.ids.length === 0 && !canMoveHere && <li className="px-1 text-sm text-fg-muted">ว่าง</li>}
      </ul>
    </div>
  );
}

function Overview({
  categories,
  onOpen,
  onAdd,
}: {
  categories: Category[];
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  if (categories.length === 0) {
    return (
      <section aria-labelledby="overview-title" className="rounded-lg border border-border bg-surface p-6">
        <h2 id="overview-title" className="font-serif text-2xl font-bold">ยังไม่มีหมวด</h2>
        <p className="mt-2 text-fg-muted">สร้างหมวดแรก แล้วเพิ่มของที่อยากจัดอันดับ</p>
        <button type="button" className="btn btn-primary mt-4" onClick={onAdd}>+ หมวดใหม่</button>
      </section>
    );
  }
  return (
    <section aria-labelledby="overview-title">
      <h2 id="overview-title" className="font-serif text-2xl font-bold">ภาพรวมทุกหมวด</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <OverviewCard key={c.id} category={c} onOpen={() => onOpen(c.id)} />
        ))}
      </ul>
    </section>
  );
}

function OverviewCard({ category: c, onOpen }: { category: Category; onOpen: () => void }) {
  const d = distribution(c);
  const ranked = d.total - d.unranked;
  const summary = d.tiers.map((t) => `${t.label} ${t.count}`).join(', ');
  return (
    <li className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-serif text-xl font-bold wrap-anywhere">{c.name}</h3>
        <span className="shrink-0 text-sm text-fg-muted">
          จัดแล้ว {ranked}/{d.total}
        </span>
      </div>

      <div
        className="mt-3 flex h-4 overflow-hidden rounded-full border border-border bg-bg"
        role="img"
        aria-label={`สัดส่วนแต่ละแถว: ${summary}, ยังไม่จัด ${d.unranked}`}
      >
        {d.total > 0 &&
          d.tiers.map((t, i) =>
            t.count > 0 ? (
              <span
                key={t.tierId}
                style={{ width: `${(t.count / d.total) * 100}%`, background: fillFor(t.label, i) }}
                className="h-full border-r border-surface last:border-r-0"
              />
            ) : null,
          )}
      </div>

      <dl className="mt-3 space-y-1">
        {c.tiers.map((t, i) => (
          <div key={t.id} className="flex items-start gap-2">
            <dt
              className="inline-flex min-w-9 shrink-0 justify-center rounded px-1 text-sm font-bold text-fg"
              style={{ background: fillFor(t.label, i) }}
            >
              {t.label}
            </dt>
            <dd className="min-w-0 text-sm wrap-anywhere">
              {t.itemIds.length ? t.itemIds.map((id) => c.items[id].label).join(' · ') : <span className="text-fg-muted">—</span>}
            </dd>
          </div>
        ))}
      </dl>

      <button type="button" className="btn btn-secondary mt-4 self-start" onClick={onOpen}>
        เปิดหมวดนี้
      </button>
    </li>
  );
}

type Notice = { text: string; tone: 'success' | 'error' } | null;

function BackupTools({ state, ask, onImport }: { state: State; ask: Ask; onImport: (s: State) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const setMessage = (text: string, tone: 'success' | 'error' = 'success') => setNotice({ text, tone });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tierlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('ดาวน์โหลดไฟล์สำรองแล้ว');
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseState(JSON.parse(await file.text()));
      if (!parsed) throw new Error('shape');
      ask({
        kind: 'confirm',
        title: 'นำเข้าไฟล์สำรอง?',
        message: 'ข้อมูลทั้งหมดที่มีตอนนี้จะถูกแทนที่ด้วยไฟล์นี้',
        confirmLabel: 'แทนที่ข้อมูล',
        danger: true,
        returnFocus: importRef.current,
        onConfirm: () => {
          onImport(parsed);
          setMessage('นำเข้าแล้ว');
        },
      });
    } catch {
      setMessage('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Tier List', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section aria-labelledby="backup-title" className="mt-12 border-t border-border pt-6">
      <h2 id="backup-title" className="font-semibold">สำรองข้อมูล</h2>
      <p className="mt-1 text-sm text-fg-muted">ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น ดาวน์โหลดไว้ก่อนล้างเบราว์เซอร์หรือย้ายเครื่อง
        แอปส่งเฉพาะรายงานข้อผิดพลาดทางเทคนิคไปที่ Sentry เพื่อแก้บั๊ก ไม่ส่งรายการที่คุณจัดอันดับ</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={exportJson}>ดาวน์โหลด JSON</button>
        <button ref={importRef} type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          นำเข้า JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => importJson(e.target.files?.[0])}
        />
      </div>
      <p
        className={`mt-2 flex min-h-6 items-center gap-1.5 text-sm font-semibold ${
          notice?.tone === 'error' ? 'text-danger' : 'text-success'
        }`}
        role="status"
      >
        {notice && (
          <>
            {notice.tone === 'error' ? <AlertIcon /> : <CheckIcon />}
            <span>{notice.text}</span>
          </>
        )}
      </p>
    </section>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

const CheckIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="8" />
    <path d="m6.5 10.2 2.3 2.3 4.7-4.8" />
  </Icon>
);

const AlertIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6v4.5M10 13.8v.2" />
  </Icon>
);

/** Rename / reset / delete live behind one "⋯" button so the board starts higher on phones. */
function CategoryMenu({ onRename, onReset, onRemove }: { onRename: () => void; onReset: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus goes back to the toggle first, so a dialog opened from here returns focus to it.
  const pick = (fn: () => void) => () => {
    setOpen(false);
    toggle.current?.focus();
    fn();
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={toggle}
        type="button"
        className="btn btn-secondary px-3"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className="text-xl leading-none">⋯</span>
        <span className="sr-only">จัดการหมวด</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <button type="button" className="btn btn-ghost justify-start" onClick={pick(onRename)}>แก้ชื่อหมวด</button>
          <button type="button" className="btn btn-ghost justify-start" onClick={pick(onReset)}>ล้างอันดับ</button>
          <button type="button" className="btn btn-danger justify-start" onClick={pick(onRemove)}>ลบหมวด</button>
        </div>
      )}
    </div>
  );
}
