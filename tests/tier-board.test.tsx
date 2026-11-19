// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TierBoard, { STORAGE_KEY, loadSaved, newId } from '@/app/tier-board';
import { initialState, makeCategory } from '@/lib/tierlist';

function seed() {
  let n = 0;
  return initialState(() => `t-${++n}`);
}

const row = (name: string) => screen.getByRole('list', { name: `แถว ${name}` });
const dialog = () => screen.getByRole('dialog');
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'จัดการหมวด' }));
/** Fill the in-app prompt and submit it. */
function answer(value: string) {
  const d = dialog();
  fireEvent.change(within(d).getByRole('textbox'), { target: { value } });
  fireEvent.submit(d.querySelector('form')!);
}
const announcer = () => screen.getByTestId('board-announcer');

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(cleanup);

describe('TierBoard', () => {
  it('moves an item by tap: select, then "move here"', () => {
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    expect(screen.getByRole('button', { name: 'ส้มตำ' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('เลือกอยู่:', { exact: false }).textContent).toContain('ส้มตำ');
    fireEvent.click(within(row('S')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    expect(within(row('S')).getByRole('button', { name: 'ส้มตำ' })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    // The first-run sample already ranks one dish in S.
    expect(saved.categories[0].tiers[0].itemIds).toHaveLength(2);
    expect(announcer().getAttribute('aria-live')).toBe('polite');
    expect(announcer().textContent).toBe('ย้าย ส้มตำ ไปแถว S แล้ว');
    fireEvent.click(within(row('S')).getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('ยังไม่จัด')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    expect(announcer().textContent).toBe('ย้าย ส้มตำ ไปแถว ยังไม่จัด แล้ว');
  });

  it('toggles and cancels a selection, and deletes the selected item', () => {
    render(<TierBoard />);
    const item = () => screen.queryByRole('button', { name: 'ผัดไทย' });
    fireEvent.click(item()!);
    fireEvent.click(item()!);
    expect(item()!.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(item()!);
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.queryByRole('button', { name: 'ลบชิ้นนี้' })).toBeNull();
    fireEvent.click(item()!);
    const del = screen.getByRole('button', { name: 'ลบชิ้นนี้' });
    expect(del.className).toContain('btn-danger');
    fireEvent.click(del);
    expect(item()).toBeNull();
    expect(announcer().textContent).toBe('ลบ ผัดไทย แล้ว');
  });

  it('moves an item by drag and drop, onto a row and before another item', () => {
    render(<TierBoard />);
    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => (data[k] = v),
      getData: (k: string) => data[k] ?? '',
      effectAllowed: '',
    };
    const drag = (name: string) => fireEvent.dragStart(screen.getByRole('button', { name }), { dataTransfer });

    drag('ข้าวซอย');
    fireEvent.dragOver(row('A'), { dataTransfer });
    fireEvent.dragLeave(row('A'), { dataTransfer });
    fireEvent.drop(row('A'), { dataTransfer });
    drag('ต้มยำกุ้ง');
    fireEvent.drop(within(row('A')).getByRole('button', { name: 'ข้าวซอย' }).parentElement!, { dataTransfer });
    const labels = within(row('A')).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['ข้าวมันไก่', 'ต้มยำกุ้ง', 'ข้าวซอย']);
    expect(announcer().textContent).toBe('ย้าย ต้มยำกุ้ง ไปแถว A แล้ว');

    data['text/plain'] = 'ghost';
    fireEvent.drop(row('B'), { dataTransfer });
    expect(within(row('B')).queryAllByRole('button')).toHaveLength(0);
  });

  it('adds items from the form and ignores blanks', () => {
    render(<TierBoard />);
    const input = screen.getByRole('textbox', { name: 'เพิ่มของในหมวดนี้' });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'ผัดกะเพรา' } });
    fireEvent.submit(input.closest('form')!);
    expect(within(row('ยังไม่จัด')).getByRole('button', { name: 'ผัดกะเพรา' })).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('renames the category and a tier, resets ranks, removes the category, all in app dialogs', () => {
    const prompt = vi.spyOn(window, 'prompt');
    const confirm = vi.spyOn(window, 'confirm');
    render(<TierBoard />);

    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'แก้ชื่อหมวด' }));
    expect(screen.getByRole('heading', { name: 'แก้ชื่อหมวด' })).toBeTruthy();
    expect((within(dialog()).getByLabelText('ชื่อหมวด') as HTMLInputElement).value).toBe('อาหารไทย');
    answer('อาหาร');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'อาหาร' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'แถว S แตะเพื่อแก้ชื่อ' }));
    const tierInput = within(dialog()).getByLabelText('ชื่อแถว (ไม่เกิน 12 ตัวอักษร)') as HTMLInputElement;
    expect(tierInput.maxLength).toBe(12);
    answer('   ');
    expect(dialog()).toBeTruthy();
    answer('เทพ');
    expect(screen.getByRole('list', { name: 'แถว เทพ' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('เทพ')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างอันดับ' }));
    expect(within(row('ยังไม่จัด')).getByRole('button', { name: 'ส้มตำ' })).toBeTruthy();
    expect(announcer().textContent).toContain('ยังไม่จัด');

    openMenu();
    const del = screen.getByRole('button', { name: 'ลบหมวด' });
    expect(del.className).toContain('btn-danger');
    fireEvent.click(del);
    expect(screen.getByRole('heading', { name: 'ลบหมวด "อาหาร"?' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.getByRole('heading', { level: 2, name: 'อาหาร' })).toBeTruthy();
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ลบหมวด' }));
    const confirmBtn = within(dialog()).getByRole('button', { name: 'ลบหมวด' });
    expect(confirmBtn.className).toContain('btn-danger-solid');
    fireEvent.click(confirmBtn);
    expect(screen.getByRole('heading', { level: 2, name: 'ภาษาโปรแกรม' })).toBeTruthy();
    expect(announcer().textContent).toBe('ลบหมวด อาหาร แล้ว');
    expect(prompt).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('adds a category from the tab bar, and cancelling adds nothing', () => {
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('button', { name: /ภาพรวม|อาหารไทย|ภาษาโปรแกรม/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
    answer('หนัง');
    expect(screen.getByRole('button', { name: 'หนัง' }).getAttribute('aria-current')).toBe('page');
  });

  it('closes the dialog with Esc and returns focus to the button that opened it', async () => {
    render(<TierBoard />);
    const trigger = screen.getByRole('button', { name: '+ หมวดใหม่' });
    trigger.focus();
    fireEvent.click(trigger);
    const d = dialog();
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.activeElement).toBe(within(d).getByRole('textbox'));
    fireEvent(d, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('uses the native modal dialog where the browser has one', async () => {
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });
    Object.assign(proto, { showModal, close });
    try {
      render(<TierBoard />);
      fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
      expect(showModal).toHaveBeenCalledTimes(1);
      answer('เกม');
      expect(close).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { level: 2, name: 'เกม' })).toBeTruthy();
      // The browser closing it on its own (second Esc) also cleans up.
      fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
      fireEvent(dialog(), new Event('close'));
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      delete proto.showModal;
      delete proto.close;
    }
  });

  it('sends focus back to the open tab when the opener is gone', async () => {
    render(<TierBoard />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ลบหมวด' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'ลบหมวด' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ภาษาโปรแกรม' })));
  });

  it('closes the category menu with Esc or a click outside', () => {
    render(<TierBoard />);
    const toggle = screen.getByRole('button', { name: 'จัดการหมวด' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'แก้ชื่อหมวด' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: 'แก้ชื่อหมวด' })).toBeNull();
  });

  it('shows the overview with counts and opens a category from it', () => {
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('B')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวม' }));
    expect(screen.getByRole('heading', { name: 'ภาพรวมทุกหมวด' })).toBeTruthy();
    expect(screen.getByText('จัดแล้ว 3/6')).toBeTruthy();
    expect(screen.getAllByRole('img')[0].getAttribute('aria-label')).toContain('B 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'เปิดหมวดนี้' })[1]);
    expect(screen.getByRole('heading', { level: 2, name: 'ภาษาโปรแกรม' })).toBeTruthy();
  });

  it('shows an empty overview with a create button', () => {
    render(<TierBoard initial={{ version: 1, activeId: null, categories: [] }} />);
    expect(screen.getByRole('heading', { name: 'ยังไม่มีหมวด' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '+ หมวดใหม่' })[1]);
    answer('เกม');
    expect(screen.getByRole('heading', { level: 2, name: 'เกม' })).toBeTruthy();
  });

  it('loads the saved board from storage', () => {
    let n = 0;
    const saved = { version: 1, activeId: null, categories: [makeCategory('ร้านกาแฟ', ['Roast'], () => `s-${++n}`)] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    render(<TierBoard />);
    expect(screen.getByRole('heading', { level: 3, name: 'ร้านกาแฟ' })).toBeTruthy();
  });

  it('keeps the saved board under Strict Mode effect replay', () => {
    let n = 0;
    const saved = { version: 1, activeId: null, categories: [makeCategory('เก็บไว้', ['X'], () => `k-${++n}`)] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    render(<StrictMode><TierBoard /></StrictMode>);
    expect(screen.getByRole('heading', { level: 3, name: 'เก็บไว้' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).categories[0].name).toBe('เก็บไว้');
  });

  it('takes another tab\'s save and does not overwrite it by switching tabs', () => {
    render(<TierBoard />);
    let n = 0;
    const newer = { version: 1, activeId: null, categories: [makeCategory('จากแท็บอื่น', ['Y'], () => `o-${++n}`)] };
    const json = JSON.stringify(newer);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '{}' }));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{' }));
    });
    expect(screen.queryByRole('button', { name: 'จากแท็บอื่น' })).toBeNull();
    localStorage.setItem(STORAGE_KEY, json);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: json }));
    });
    expect(screen.getByRole('button', { name: 'จากแท็บอื่น' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'จากแท็บอื่น' }));
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวม' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(json);
  });

  it('keeps this tab\'s open category on sync when it still exists', () => {
    render(<TierBoard initial={seed()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ภาษาโปรแกรม' }));
    const other = { ...seed(), activeId: seed().categories[0].id };
    other.categories[1] = { ...other.categories[1], name: 'ภาษา' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(other));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(other) }));
    });
    expect(screen.getByRole('heading', { level: 2, name: 'ภาษา' })).toBeTruthy();
  });

  it('applies the latest save, not a late event\'s older snapshot, and never writes it back', () => {
    render(<TierBoard initial={seed()} />);
    let n = 0;
    const older = { version: 1, activeId: null, categories: [makeCategory('เก่า', ['X'], () => `a-${++n}`)] };
    const newer = { version: 1, activeId: null, categories: [makeCategory('ใหม่', ['Y'], () => `b-${++n}`)] };
    const newerJson = JSON.stringify(newer);
    // The other tab saved twice before this tab saw the first event.
    localStorage.setItem(STORAGE_KEY, newerJson);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(older) }));
    });
    expect(screen.getByRole('button', { name: 'ใหม่' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'เก่า' })).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newerJson);
  });

  it('does not write a synced board back even if storage changed again since', () => {
    render(<TierBoard initial={seed()} />);
    let n = 0;
    const first = JSON.stringify({ version: 1, activeId: null, categories: [makeCategory('หนึ่ง', [], () => `c-${++n}`)] });
    const second = JSON.stringify({ version: 1, activeId: null, categories: [makeCategory('สอง', [], () => `d-${++n}`)] });
    localStorage.setItem(STORAGE_KEY, first);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: first }));
    });
    localStorage.setItem(STORAGE_KEY, second);
    setItem.mockClear();
    // Switching categories is not an edit, so the synced board is not written over "second".
    fireEvent.click(screen.getByRole('button', { name: 'หนึ่ง' }));
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวม' }));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(second);
  });

  it('saves an edit once, so a later category switch does not overwrite a newer save', () => {
    render(<TierBoard initial={seed()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('S')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    // Another tab saves a newer board; its storage event has not reached this tab yet.
    let n = 0;
    const newer = JSON.stringify({ version: 1, activeId: null, categories: [makeCategory('ใหม่', [], () => `e-${++n}`)] });
    localStorage.setItem(STORAGE_KEY, newer);
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวม' }));
    fireEvent.click(screen.getByRole('button', { name: 'อาหารไทย' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('exports and imports JSON backups', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<TierBoard initial={seed()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลด JSON' }));
    expect(click).toHaveBeenCalled();
    const ok = screen.getByText('ดาวน์โหลดไฟล์สำรองแล้ว').parentElement!;
    expect(ok.className).toContain('text-success');
    expect(ok.querySelector('svg[aria-hidden="true"]')).toBeTruthy();

    const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
    const clickInput = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'นำเข้า JSON' }));
    expect(clickInput).toHaveBeenCalled();

    const upload = async (text: string) => {
      // jsdom's File has no text(); browsers do.
      const file = Object.assign(new File([text], 'b.json', { type: 'application/json' }), { text: async () => text });
      // React skips change events on an input whose tracked value did not move; the component
      // clears the value after each import, so mark it dirty the way a real file pick would.
      (fileInput as unknown as { _valueTracker?: { setValue(v: string): void } })._valueTracker?.setValue('C:\\fakepath\\old.json');
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
    };
    await upload('not json');
    expect(screen.getByText('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Tier List').parentElement!.className).toContain('text-danger');

    let n = 0;
    const backup = { version: 1, activeId: null, categories: [makeCategory('นำเข้า', [], () => `i-${++n}`)] };
    await upload(JSON.stringify(backup));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.queryByText('นำเข้าแล้ว')).toBeNull();
    await upload(JSON.stringify(backup));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'แทนที่ข้อมูล' }));
    expect(screen.getByText('นำเข้าแล้ว').parentElement!.className).toContain('text-success');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'นำเข้า JSON' })));
    expect(screen.getByRole('button', { name: 'นำเข้า' })).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('C')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    expect(within(row('C')).getByRole('button', { name: 'ส้มตำ' })).toBeTruthy();
  });
});

describe('helpers', () => {
  it('loadSaved returns null for missing, broken or unreadable storage', () => {
    expect(loadSaved(undefined)).toBeNull();
    expect(loadSaved({ getItem: () => null })).toBeNull();
    expect(loadSaved({ getItem: () => '{' })).toBeNull();
    expect(loadSaved({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });

  it('newId gives unique ids', () => {
    expect(newId()).not.toBe(newId());
  });
});
