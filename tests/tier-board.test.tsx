// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TierBoard, { STORAGE_KEY, loadSaved, newId } from '@/app/tier-board';
import { initialState, makeCategory } from '@/lib/tierlist';

function seed() {
  let n = 0;
  return initialState(() => `t-${++n}`);
}

const row = (name: string) => screen.getByRole('list', { name: `แถว ${name}` });

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
    expect(saved.categories[0].tiers[0].itemIds).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'ลบชิ้นนี้' }));
    expect(item()).toBeNull();
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
    expect(labels).toEqual(['ต้มยำกุ้ง', 'ข้าวซอย']);

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

  it('renames the category and a tier, resets ranks, removes the category', () => {
    const prompt = vi.spyOn(window, 'prompt');
    const confirm = vi.spyOn(window, 'confirm');
    render(<TierBoard />);

    prompt.mockReturnValueOnce('อาหาร');
    fireEvent.click(screen.getByRole('button', { name: 'แก้ชื่อ' }));
    expect(screen.getByRole('heading', { level: 2, name: 'อาหาร' })).toBeTruthy();

    prompt.mockReturnValueOnce('เทพ');
    fireEvent.click(screen.getByRole('button', { name: 'แถว S แตะเพื่อแก้ชื่อ' }));
    expect(screen.getByRole('list', { name: 'แถว เทพ' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('เทพ')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    fireEvent.click(screen.getByRole('button', { name: 'ล้างอันดับ' }));
    expect(within(row('ยังไม่จัด')).getByRole('button', { name: 'ส้มตำ' })).toBeTruthy();

    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'ลบหมวด' }));
    expect(screen.getByRole('heading', { level: 2, name: 'อาหาร' })).toBeTruthy();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'ลบหมวด' }));
    expect(screen.getByRole('heading', { level: 2, name: 'ภาษาโปรแกรม' })).toBeTruthy();
  });

  it('adds a category from the tab bar, and skips an empty name', () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('').mockReturnValueOnce('หนัง');
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
    expect(screen.queryByRole('button', { name: 'หนัง' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ หมวดใหม่' }));
    expect(screen.getByRole('button', { name: 'หนัง' }).getAttribute('aria-current')).toBe('page');
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it('shows the overview with counts and opens a category from it', () => {
    render(<TierBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'ส้มตำ' }));
    fireEvent.click(within(row('B')).getByRole('button', { name: 'ย้ายมาที่นี่' }));
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวม' }));
    expect(screen.getByRole('heading', { name: 'ภาพรวมทุกหมวด' })).toBeTruthy();
    expect(screen.getByText('จัดแล้ว 1/6')).toBeTruthy();
    expect(screen.getAllByRole('img')[0].getAttribute('aria-label')).toContain('B 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'เปิดหมวดนี้' })[1]);
    expect(screen.getByRole('heading', { level: 2, name: 'ภาษาโปรแกรม' })).toBeTruthy();
  });

  it('shows an empty overview with a create button', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('เกม');
    render(<TierBoard initial={{ version: 1, activeId: null, categories: [] }} />);
    expect(screen.getByRole('heading', { name: 'ยังไม่มีหมวด' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '+ หมวดใหม่' })[1]);
    expect(screen.getByRole('heading', { level: 2, name: 'เกม' })).toBeTruthy();
  });

  it('loads the saved board from storage', () => {
    let n = 0;
    const saved = { version: 1, activeId: null, categories: [makeCategory('ร้านกาแฟ', ['Roast'], () => `s-${++n}`)] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    render(<TierBoard />);
    expect(screen.getByRole('heading', { level: 3, name: 'ร้านกาแฟ' })).toBeTruthy();
  });

  it('exports and imports JSON backups', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const confirm = vi.spyOn(window, 'confirm');
    render(<TierBoard initial={seed()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลด JSON' }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByText('ดาวน์โหลดไฟล์สำรองแล้ว')).toBeTruthy();

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
    expect(screen.getByText('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Tier List')).toBeTruthy();

    let n = 0;
    const backup = { version: 1, activeId: null, categories: [makeCategory('นำเข้า', [], () => `i-${++n}`)] };
    confirm.mockReturnValueOnce(false);
    await upload(JSON.stringify(backup));
    expect(screen.queryByText('นำเข้าแล้ว')).toBeNull();
    confirm.mockReturnValueOnce(true);
    await upload(JSON.stringify(backup));
    expect(screen.getByText('นำเข้าแล้ว')).toBeTruthy();
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
