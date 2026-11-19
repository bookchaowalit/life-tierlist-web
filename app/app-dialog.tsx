'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

/** What the board asks for: a short text (replaces window.prompt) or a yes/no (window.confirm). */
export type DialogRequest = { id: number; title: string; returnFocus?: HTMLElement | null } & (
  | { kind: 'prompt'; label: string; initial?: string; maxLength?: number; confirmLabel?: string; onSubmit: (value: string) => void }
  | { kind: 'confirm'; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }
);

type Props = {
  request: DialogRequest | null;
  onDone: () => void;
  /** Where focus goes when the element that opened the dialog is gone (e.g. a deleted category). */
  fallbackFocus?: () => HTMLElement | null | undefined;
};

export function AppDialog({ request, onDone, fallbackFocus }: Props) {
  if (!request) return null;
  return <DialogInner key={request.id} request={request} onDone={onDone} fallbackFocus={fallbackFocus} />;
}

function DialogInner({ request, onDone, fallbackFocus }: Props & { request: DialogRequest }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closed = useRef(false);
  const titleId = useId();
  const inputId = useId();
  // Read once when the dialog opens: the button that asked, so focus can go back to it.
  const [returnTo] = useState(() =>
    request.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null),
  );
  const [value, setValue] = useState(request.kind === 'prompt' ? (request.initial ?? '') : '');

  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    try {
      d.showModal();
    } catch {
      // Older engines without modal dialogs still get a visible, labelled dialog.
      d.setAttribute('open', '');
    }
    d.querySelector<HTMLElement>('input, [data-autofocus]')?.focus();
  }, []);

  const finish = (action?: () => void) => {
    if (closed.current) return;
    closed.current = true;
    const d = ref.current;
    if (d?.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
    action?.();
    onDone();
    // After React has applied the action, so a removed trigger falls back to a live element.
    setTimeout(() => {
      const target = returnTo?.isConnected ? returnTo : fallbackFocus?.();
      target?.focus();
    }, 0);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (request.kind === 'confirm') return finish(request.onConfirm);
    const text = value.trim();
    if (!text) return;
    finish(() => request.onSubmit(text));
  };

  const primary =
    request.kind === 'confirm' && request.danger ? 'btn btn-danger-solid' : 'btn btn-primary';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="app-dialog"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      onClose={() => finish()}
    >
      <form onSubmit={submit}>
        <h2 id={titleId} className="font-serif text-xl font-bold wrap-anywhere">
          {request.title}
        </h2>
        {request.kind === 'prompt' ? (
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor={inputId} className="font-semibold">
              {request.label}
            </label>
            <input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={request.maxLength ?? 60}
              required
              className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-fg"
            />
          </div>
        ) : (
          <p className="mt-3 text-fg-muted wrap-anywhere">{request.message}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => finish()}>
            ยกเลิก
          </button>
          <button type="submit" className={primary} data-autofocus={request.kind === 'confirm' ? '' : undefined}>
            {request.kind === 'prompt' ? (request.confirmLabel ?? 'บันทึก') : request.confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
