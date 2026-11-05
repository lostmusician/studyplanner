import { useCallback, useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  if (typeof window === 'undefined') return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  );
};

let bodyLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

const lockBodyScroll = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  bodyLockCount += 1;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  if (bodyLockCount === 0) return;
  bodyLockCount -= 1;
  if (bodyLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
};

interface Options<T extends HTMLElement, U extends HTMLElement> {
  /** Whether the dialog/panel is currently mounted/open. */
  active: boolean;
  /** Modal surfaces trap Tab and lock body scrolling; nonmodal flyouts do not. */
  modal: boolean;
  containerRef: RefObject<T | null>;
  initialFocusRef?: RefObject<U | null>;
  onClose: () => void;
  /** Set false to leave focus where it is when the surface closes. */
  restoreFocus?: boolean;
}

/** Focus management shared by the Explore details dialog and the settings
 * surface: moves focus inside on open, restores the opener on close, closes on
 * Escape, and (when modal) traps Tab and locks body scroll. The modal flag can
 * change while open, so a settings flyout becoming a sheet on resize picks up
 * trapping/scroll-lock automatically. */
export const useModalFocus = <T extends HTMLElement, U extends HTMLElement = HTMLElement>({
  active,
  modal,
  containerRef,
  initialFocusRef,
  onClose,
  restoreFocus = true,
}: Options<T, U>) => {
  const openerRef = useRef<HTMLElement | null>(null);
  const skipRestoreRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    skipRestoreRef.current = false;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialTarget = initialFocusRef?.current ?? containerRef.current;
    initialTarget?.focus({ preventScroll: true });

    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (!restoreFocus || skipRestoreRef.current) return;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (!modal || event.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const currentIndex =
        document.activeElement instanceof HTMLElement
          ? focusable.indexOf(document.activeElement)
          : -1;
      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        }
      } else if (currentIndex === -1 || currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (modal) lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (modal) unlockBodyScroll();
    };
  }, [active, modal, containerRef]);

  const skipRestore = useCallback(() => {
    skipRestoreRef.current = true;
  }, []);

  return { skipRestore };
};
