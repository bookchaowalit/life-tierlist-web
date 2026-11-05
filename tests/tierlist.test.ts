import { describe, expect, it } from 'vitest';
import {
  type Action,
  type State,
  DEFAULT_TIERS,
  FALLBACK_FILL,
  POOL,
  TIER_FILLS,
  distribution,
  fillFor,
  initialState,
  makeCategory,
  parseState,
  reducer,
} from '@/lib/tierlist';

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

function setup() {
  const newId = ids();
  const state: State = { version: 1, activeId: null, categories: [makeCategory('Fruit', ['Apple', 'Mango', '  '], newId)] };
  const run = (s: State, a: Action) => reducer(s, a, newId);
  const cat = state.categories[0];
  return { state, run, cat, newId };
}

describe('makeCategory / initialState', () => {
  it('builds S..D tiers and puts non-blank labels in the pool', () => {
    const { cat } = setup();
    expect(cat.tiers.map((t) => t.label)).toEqual([...DEFAULT_TIERS]);
    expect(cat.pool.map((id) => cat.items[id].label)).toEqual(['Apple', 'Mango']);
  });

  it('falls back to a default name', () => {
    expect(makeCategory('   ', [], ids()).name).toBe('หมวดใหม่');
  });

  it('starts with two sample categories and the first active', () => {
    const s = initialState(ids());
    expect(s.categories).toHaveLength(2);
    expect(s.activeId).toBe(s.categories[0].id);
  });
});

describe('reducer', () => {
  it('adds a category and makes it active', () => {
    const { state, run } = setup();
    const next = run(state, { type: 'addCategory', name: 'Games' });
    expect(next.categories).toHaveLength(2);
    expect(next.activeId).toBe(next.categories[1].id);
    expect(next.categories[1].name).toBe('Games');
  });

  it('renames a category and ignores blank names and unknown ids', () => {
    const { state, run, cat } = setup();
    expect(run(state, { type: 'renameCategory', categoryId: cat.id, name: '  Fruits  ' }).categories[0].name).toBe('Fruits');
    expect(run(state, { type: 'renameCategory', categoryId: cat.id, name: ' ' })).toBe(state);
    expect(run(state, { type: 'renameCategory', categoryId: 'nope', name: 'x' })).toBe(state);
  });

  it('removes a category and moves the active tab', () => {
    const { state, run, cat } = setup();
    const two = run(state, { type: 'addCategory', name: 'B' });
    const active = run(two, { type: 'setActive', categoryId: cat.id });
    const after = run(active, { type: 'removeCategory', categoryId: cat.id });
    expect(after.categories.map((c) => c.name)).toEqual(['B']);
    expect(after.activeId).toBe(after.categories[0].id);
    const keepActive = run(two, { type: 'removeCategory', categoryId: cat.id });
    expect(keepActive.activeId).toBe(two.activeId);
    expect(run(state, { type: 'removeCategory', categoryId: 'nope' })).toBe(state);
    expect(run(state, { type: 'removeCategory', categoryId: cat.id }).activeId).toBeNull();
  });

  it('sets the active tab, null for overview, ignores unknown ids', () => {
    const { state, run, cat } = setup();
    expect(run(state, { type: 'setActive', categoryId: cat.id }).activeId).toBe(cat.id);
    expect(run(state, { type: 'setActive', categoryId: null }).activeId).toBeNull();
    expect(run(state, { type: 'setActive', categoryId: 'nope' })).toBe(state);
  });

  it('adds and removes items', () => {
    const { state, run, cat } = setup();
    const added = run(state, { type: 'addItem', categoryId: cat.id, label: ' Durian ' });
    const c = added.categories[0];
    const durian = c.pool[c.pool.length - 1];
    expect(c.items[durian].label).toBe('Durian');
    expect(run(state, { type: 'addItem', categoryId: cat.id, label: '' })).toBe(state);

    const ranked = run(added, { type: 'moveItem', categoryId: cat.id, itemId: durian, to: c.tiers[0].id });
    const removed = run(ranked, { type: 'removeItem', categoryId: cat.id, itemId: durian }).categories[0];
    expect(removed.items[durian]).toBeUndefined();
    expect(removed.tiers[0].itemIds).toEqual([]);
    const same = run(added, { type: 'removeItem', categoryId: cat.id, itemId: 'nope' });
    expect(same.categories[0]).toEqual(c);
  });

  it('caps labels at 60 characters', () => {
    const { state, run, cat } = setup();
    const c = run(state, { type: 'addItem', categoryId: cat.id, label: 'x'.repeat(100) }).categories[0];
    expect(c.items[c.pool[c.pool.length - 1]].label).toHaveLength(60);
  });

  it('moves items between tiers and the pool, at an index', () => {
    const { state, run, cat } = setup();
    const [apple, mango] = cat.pool;
    const s = cat.tiers[0].id;
    let next = run(state, { type: 'moveItem', categoryId: cat.id, itemId: apple, to: s });
    next = run(next, { type: 'moveItem', categoryId: cat.id, itemId: mango, to: s, index: 0 });
    let c = next.categories[0];
    expect(c.tiers[0].itemIds).toEqual([mango, apple]);
    expect(c.pool).toEqual([]);

    next = run(next, { type: 'moveItem', categoryId: cat.id, itemId: apple, to: POOL });
    next = run(next, { type: 'moveItem', categoryId: cat.id, itemId: mango, to: POOL, index: 0 });
    c = next.categories[0];
    expect(c.pool).toEqual([mango, apple]);
    expect(c.tiers[0].itemIds).toEqual([]);

    const bad = run(state, { type: 'moveItem', categoryId: cat.id, itemId: apple, to: 'no-tier' });
    expect(bad.categories[0]).toEqual(cat);
    const ghost = run(state, { type: 'moveItem', categoryId: cat.id, itemId: 'ghost', to: s });
    expect(ghost.categories[0]).toEqual(cat);
    const far = run(state, { type: 'moveItem', categoryId: cat.id, itemId: apple, to: POOL, index: 99 });
    expect(far.categories[0].pool).toEqual([mango, apple]);
  });

  it('renames tiers up to 12 characters, ignoring blanks', () => {
    const { state, run, cat } = setup();
    const t = cat.tiers[0].id;
    expect(run(state, { type: 'renameTier', categoryId: cat.id, tierId: t, label: 'God tier forever' }).categories[0].tiers[0].label).toBe('God tier for');
    expect(run(state, { type: 'renameTier', categoryId: cat.id, tierId: t, label: '' })).toBe(state);
  });

  it('resets a category: every ranked item back to the pool', () => {
    const { state, run, cat } = setup();
    const [apple, mango] = cat.pool;
    const moved = run(state, { type: 'moveItem', categoryId: cat.id, itemId: mango, to: cat.tiers[2].id });
    const reset = run(moved, { type: 'resetCategory', categoryId: cat.id }).categories[0];
    expect(reset.pool).toEqual([mango, apple]);
    expect(reset.tiers.every((t) => t.itemIds.length === 0)).toBe(true);
  });

  it('replaces the whole state', () => {
    const { state, run } = setup();
    const other = initialState(ids());
    expect(run(state, { type: 'replace', state: other })).toBe(other);
  });
});

describe('distribution / fillFor', () => {
  it('counts per tier and unranked', () => {
    const { state, run, cat } = setup();
    const moved = run(state, { type: 'moveItem', categoryId: cat.id, itemId: cat.pool[0], to: cat.tiers[1].id });
    const d = distribution(moved.categories[0]);
    expect(d.total).toBe(2);
    expect(d.unranked).toBe(1);
    expect(d.tiers.map((t) => t.count)).toEqual([0, 1, 0, 0, 0]);
  });

  it('picks a fill by label, then by position, then the fallback', () => {
    expect(fillFor('S', 4)).toBe(TIER_FILLS.S);
    expect(fillFor('Top', 1)).toBe(TIER_FILLS.A);
    expect(fillFor('Extra', 9)).toBe(FALLBACK_FILL);
  });
});

describe('parseState', () => {
  it('round-trips a valid state', () => {
    const s = initialState(ids());
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseState({ ...s, activeId: null })?.activeId).toBeNull();
    expect(parseState({ ...s, activeId: 'gone' })?.activeId).toBe(s.categories[0].id);
  });

  it('rejects wrong shapes', () => {
    const good = initialState(ids());
    const c = good.categories[0];
    const bad: unknown[] = [
      null,
      'x',
      { version: 2, categories: [] },
      { version: 1, categories: 'x' },
      { version: 1, categories: [null] },
      { version: 1, categories: [{ ...c, tiers: 'x' }] },
      { version: 1, categories: [{ ...c, items: null }] },
      { version: 1, categories: [{ ...c, items: { a: { id: 'b', label: 'x' } } }] },
      { version: 1, categories: [{ ...c, tiers: [{ id: 't', label: 'S', itemIds: [1] }] }] },
    ];
    for (const raw of bad) expect(parseState(raw)).toBeNull();
  });

  it('drops dangling and duplicate ids and rescues orphans to the pool', () => {
    const raw = {
      version: 1,
      activeId: 'c',
      categories: [
        {
          id: 'c',
          name: 'C',
          items: { a: { id: 'a', label: 'A' }, b: { id: 'b', label: 'B' }, o: { id: 'o', label: 'O' } },
          tiers: [{ id: 's', label: 'S', itemIds: ['a', 'ghost', 'a'] }],
          pool: ['a', 'b'],
        },
      ],
    };
    const c = parseState(raw)!.categories[0];
    expect(c.tiers[0].itemIds).toEqual(['a']);
    expect(c.pool).toEqual(['b', 'o']);
  });
});
