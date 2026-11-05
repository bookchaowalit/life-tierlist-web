'use client';

import { type DragEvent, useEffect, useReducer, useRef, useState } from 'react';
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

type Board = { state: State; hydrated: boolean };
type BoardAction = Action | { type: 'hydrate'; saved: State | null } | { type: 'sync'; saved: State };

function boardReducer(b: Board, a: BoardAction): Board {
  if (a.type === 'hydrate') return { state: a.saved ?? b.state, hydrated: true };
  if (a.type === 'sync') {
    // Another tab saved: take its board but keep this tab's open category when it still exists.
    const keep = b.state.activeId === null || a.saved.categories.some((c) => c.id === b.state.activeId);
    return { ...b, state: keep ? { ...a.saved, activeId: b.state.activeId } : a.saved };
  }
  return { ...b, state: reducer(b.state, a, newId) };
}

export default function TierBoard({ initial }: { initial?: State }) {
  // hydrated lives in committed state, not a ref, so a Strict Mode effect replay before the
  // saved board is read can never write the seed board over it.
  const [board, dispatch] = useReducer(boardReducer, { state: initial ?? seedState(), hydrated: false });
  const { state, hydrated } = board;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    dispatch({ type: 'hydrate', saved: loadSaved(safeStorage()) });
    // Other tabs' saves arrive here, so a stale tab never writes an old board over a newer one.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      const saved = loadSaved({ getItem: () => e.newValue });
      if (saved) dispatch({ type: 'sync', saved });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (hydrated) persist(state);
  }, [state, hydrated]);

  const active = state.categories.find((c) => c.id === state.activeId) ?? null;

  const go = (categoryId: string | null) => {
    setSelected(null);
    dispatch({ type: 'setActive', categoryId });
  };

  const addCategory = () => {
    const name = window.prompt('ชื่อหมวดใหม่ เช่น หนัง, เกม, ร้านกาแฟ');
    if (name && name.trim()) {
      setSelected(null);
      dispatch({ type: 'addCategory', name });
    }
  };

  return (
    <div>
      <nav aria-label="หมวด" className="flex flex-wrap gap-2">
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
          />
        ) : (
          <Overview categories={state.categories} onOpen={go} onAdd={addCategory} />
        )}
      </div>

      <BackupTools state={state} onImport={(s) => { setSelected(null); dispatch({ type: 'replace', state: s }); }} />
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
        current ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface text-fg'
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
};

function CategoryView({ category: c, dispatch, selected, setSelected }: ViewProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItem = selected && hasItem(c, selected) ? c.items[selected] : undefined;

  const move = (itemId: string, to: string, index?: number) => {
    dispatch({ type: 'moveItem', categoryId: c.id, itemId, to, index });
    setSelected(null);
  };

  const add = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!draft.trim()) return;
    dispatch({ type: 'addItem', categoryId: c.id, label: draft });
    setDraft('');
    inputRef.current?.focus();
  };

  const rename = () => {
    const name = window.prompt('ชื่อหมวด', c.name);
    if (name) dispatch({ type: 'renameCategory', categoryId: c.id, name });
  };

  const remove = () => {
    if (window.confirm(`ลบหมวด "${c.name}" และของทั้งหมดในหมวดนี้?`)) dispatch({ type: 'removeCategory', categoryId: c.id });
  };

  const rows = [
    ...c.tiers.map((t, i) => ({ id: t.id, label: t.label, ids: t.itemIds, fill: fillFor(t.label, i), tier: true })),
    { id: POOL, label: 'ยังไม่จัด', ids: c.pool, fill: 'var(--color-surface)', tier: false },
  ];

  return (
    <section aria-labelledby="category-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="category-title" className="min-w-0 font-serif text-2xl font-bold wrap-anywhere">{c.name}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={rename}>แก้ชื่อ</button>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'resetCategory', categoryId: c.id })}>
            ล้างอันดับ
          </button>
          <button type="button" className="btn btn-secondary" onClick={remove}>ลบหมวด</button>
        </div>
      </div>

      <p className="mt-2 text-fg-muted" id="board-help">
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
                ? () => {
                    const label = window.prompt('ชื่อแถว (ไม่เกิน 12 ตัวอักษร)', row.label);
                    if (label) dispatch({ type: 'renameTier', categoryId: c.id, tierId: row.id, label });
                  }
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
            className="btn btn-secondary"
            onClick={() => {
              dispatch({ type: 'removeItem', categoryId: c.id, itemId: selectedItem.id });
              setSelected(null);
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
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-fg"
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
            className="min-h-11 w-full rounded-md px-1 wrap-anywhere text-xl text-fg"
            aria-label={`แถว ${row.label} แตะเพื่อแก้ชื่อ`}
          >
            {row.label}
          </button>
        ) : (
          <span className="text-sm text-fg-muted">{row.label}</span>
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
                  isSel ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg text-fg'
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
              className="inline-flex min-h-11 items-center rounded-md border border-dashed border-accent px-3 font-semibold text-accent"
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

function BackupTools({ state, onImport }: { state: State; onImport: (s: State) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

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
      if (window.confirm('แทนที่ข้อมูลทั้งหมดด้วยไฟล์นี้?')) {
        onImport(parsed);
        setMessage('นำเข้าแล้ว');
      }
    } catch {
      setMessage('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Tier List');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section aria-labelledby="backup-title" className="mt-12 border-t border-border pt-6">
      <h2 id="backup-title" className="font-semibold">สำรองข้อมูล</h2>
      <p className="mt-1 text-sm text-fg-muted">ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น ดาวน์โหลดไว้ก่อนล้างเบราว์เซอร์หรือย้ายเครื่อง</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={exportJson}>ดาวน์โหลด JSON</button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>นำเข้า JSON</button>
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
      <p className="mt-2 text-sm" role="status">{message}</p>
    </section>
  );
}
