// Tier list state: categories, each with its own tier rows and an unranked pool.
// Everything here is pure so the board component only dispatches actions.

export type Item = { id: string; label: string };
export type Tier = { id: string; label: string; itemIds: string[] };
export type Category = {
  id: string;
  name: string;
  tiers: Tier[];
  pool: string[];
  items: Record<string, Item>;
};
export type State = { version: 1; activeId: string | null; categories: Category[] };

/** Where an item can sit: a tier id, or the unranked pool. */
export const POOL = 'pool';

export const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

/** One fill per default tier label; text on them is --color-fg, all ≥ 7:1. */
export const TIER_FILLS: Record<string, string> = {
  S: '#f6b3ae',
  A: '#f8cf9f',
  B: '#f3e39a',
  C: '#c4e3b0',
  D: '#b5d4ee',
};
export const FALLBACK_FILL = '#dcdcd6';

export const MAX_LABEL = 60;

export type Action =
  | { type: 'addCategory'; name: string }
  | { type: 'renameCategory'; categoryId: string; name: string }
  | { type: 'removeCategory'; categoryId: string }
  | { type: 'setActive'; categoryId: string | null }
  | { type: 'addItem'; categoryId: string; label: string }
  | { type: 'removeItem'; categoryId: string; itemId: string }
  | { type: 'moveItem'; categoryId: string; itemId: string; to: string; index?: number }
  | { type: 'renameTier'; categoryId: string; tierId: string; label: string }
  | { type: 'resetCategory'; categoryId: string }
  | { type: 'replace'; state: State };

export type IdFn = () => string;

const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);

export function makeCategory(name: string, labels: string[], newId: IdFn): Category {
  const items: Record<string, Item> = {};
  const pool: string[] = [];
  for (const raw of labels) {
    const label = clean(raw);
    if (!label) continue;
    const id = newId();
    items[id] = { id, label };
    pool.push(id);
  }
  return {
    id: newId(),
    name: clean(name) || 'หมวดใหม่',
    tiers: DEFAULT_TIERS.map((label) => ({ id: newId(), label, itemIds: [] })),
    pool,
    items,
  };
}

export function initialState(newId: IdFn): State {
  const food = makeCategory('อาหารไทย', ['ข้าวมันไก่', 'ต้มยำกุ้ง', 'ส้มตำ', 'ผัดไทย', 'แกงเขียวหวาน', 'ข้าวซอย'], newId);
  const lang = makeCategory('ภาษาโปรแกรม', ['TypeScript', 'Python', 'Go', 'Rust', 'Java', 'PHP'], newId);
  return { version: 1, activeId: food.id, categories: [food, lang] };
}

function updateCategory(state: State, id: string, fn: (c: Category) => Category): State {
  let changed = false;
  const categories = state.categories.map((c) => {
    if (c.id !== id) return c;
    changed = true;
    return fn(c);
  });
  return changed ? { ...state, categories } : state;
}

/** Remove an item id from every row of a category. */
function detach(c: Category, itemId: string): Category {
  return {
    ...c,
    pool: c.pool.filter((x) => x !== itemId),
    tiers: c.tiers.map((t) => ({ ...t, itemIds: t.itemIds.filter((x) => x !== itemId) })),
  };
}

function insertAt(list: string[], value: string, index?: number): string[] {
  const at = index === undefined || index < 0 || index > list.length ? list.length : index;
  return [...list.slice(0, at), value, ...list.slice(at)];
}

export function reducer(state: State, action: Action, newId: IdFn): State {
  switch (action.type) {
    case 'addCategory': {
      const category = makeCategory(action.name, [], newId);
      return { ...state, categories: [...state.categories, category], activeId: category.id };
    }
    case 'renameCategory': {
      const name = clean(action.name);
      if (!name) return state;
      return updateCategory(state, action.categoryId, (c) => ({ ...c, name }));
    }
    case 'removeCategory': {
      const categories = state.categories.filter((c) => c.id !== action.categoryId);
      if (categories.length === state.categories.length) return state;
      const activeId = state.activeId === action.categoryId ? (categories[0]?.id ?? null) : state.activeId;
      return { ...state, categories, activeId };
    }
    case 'setActive':
      if (action.categoryId !== null && !state.categories.some((c) => c.id === action.categoryId)) return state;
      return { ...state, activeId: action.categoryId };
    case 'addItem': {
      const label = clean(action.label);
      if (!label) return state;
      const id = newId();
      return updateCategory(state, action.categoryId, (c) => ({
        ...c,
        items: { ...c.items, [id]: { id, label } },
        pool: [...c.pool, id],
      }));
    }
    case 'removeItem':
      return updateCategory(state, action.categoryId, (c) => {
        if (!c.items[action.itemId]) return c;
        const items = { ...c.items };
        delete items[action.itemId];
        return { ...detach(c, action.itemId), items };
      });
    case 'moveItem':
      return updateCategory(state, action.categoryId, (c) => {
        if (!c.items[action.itemId]) return c;
        if (action.to !== POOL && !c.tiers.some((t) => t.id === action.to)) return c;
        const base = detach(c, action.itemId);
        if (action.to === POOL) return { ...base, pool: insertAt(base.pool, action.itemId, action.index) };
        return {
          ...base,
          tiers: base.tiers.map((t) =>
            t.id === action.to ? { ...t, itemIds: insertAt(t.itemIds, action.itemId, action.index) } : t,
          ),
        };
      });
    case 'renameTier': {
      const label = clean(action.label).slice(0, 12);
      if (!label) return state;
      return updateCategory(state, action.categoryId, (c) => ({
        ...c,
        tiers: c.tiers.map((t) => (t.id === action.tierId ? { ...t, label } : t)),
      }));
    }
    case 'resetCategory':
      return updateCategory(state, action.categoryId, (c) => ({
        ...c,
        pool: [...c.tiers.flatMap((t) => t.itemIds), ...c.pool],
        tiers: c.tiers.map((t) => ({ ...t, itemIds: [] })),
      }));
    case 'replace':
      return action.state;
  }
}

export type TierCount = { tierId: string; label: string; count: number };

/** Count per tier row plus the unranked pool, for the overview bars. */
export function distribution(c: Category): { tiers: TierCount[]; unranked: number; total: number } {
  const tiers = c.tiers.map((t) => ({ tierId: t.id, label: t.label, count: t.itemIds.length }));
  const ranked = tiers.reduce((sum, t) => sum + t.count, 0);
  return { tiers, unranked: c.pool.length, total: ranked + c.pool.length };
}

export function fillFor(label: string, index: number): string {
  return TIER_FILLS[label] ?? TIER_FILLS[DEFAULT_TIERS[index] ?? ''] ?? FALLBACK_FILL;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/**
 * Accept saved or imported JSON only when it has the exact shape, and drop item ids that point
 * nowhere or appear twice, so a hand-edited file cannot break the board.
 */
export function parseState(raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1 || !Array.isArray(s.categories)) return null;
  const categories: Category[] = [];
  for (const rc of s.categories as unknown[]) {
    if (!rc || typeof rc !== 'object') return null;
    const c = rc as Record<string, unknown>;
    if (!isStr(c.id) || !isStr(c.name) || !Array.isArray(c.tiers) || !isStrList(c.pool)) return null;
    if (!c.items || typeof c.items !== 'object') return null;
    const items: Record<string, Item> = {};
    for (const [key, ri] of Object.entries(c.items as Record<string, unknown>)) {
      const it = ri as Record<string, unknown> | null;
      if (!it || !isStr(it.label) || it.id !== key) return null;
      items[key] = { id: key, label: clean(it.label) };
    }
    const seen = new Set<string>();
    const keep = (ids: string[]) => ids.filter((id) => items[id] && !seen.has(id) && (seen.add(id), true));
    const tiers: Tier[] = [];
    for (const rt of c.tiers as unknown[]) {
      const t = rt as Record<string, unknown> | null;
      if (!t || !isStr(t.id) || !isStr(t.label) || !isStrList(t.itemIds)) return null;
      tiers.push({ id: t.id, label: clean(t.label).slice(0, 12), itemIds: keep(t.itemIds) });
    }
    const pool = keep(c.pool);
    // Items no row lists go back to the pool instead of vanishing.
    for (const id of Object.keys(items)) if (!seen.has(id)) pool.push(id);
    categories.push({ id: c.id, name: clean(c.name), tiers, pool, items });
  }
  // null means the overview tab.
  const activeId =
    s.activeId === null
      ? null
      : isStr(s.activeId) && categories.some((c) => c.id === s.activeId) ? s.activeId : (categories[0]?.id ?? null);
  return { version: 1, activeId, categories };
}
