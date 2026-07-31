/**
 * Rentora motion system
 * ---------------------
 * Apple-style, restrained motion primitives used across every page.
 *
 * Exports:
 *  - prefersReducedMotion()      : respects the OS "reduce motion" setting
 *  - <RevealText>                : word-by-word heading reveal (SplitText)
 *  - <Reveal>                    : single element fade + slide on scroll
 *  - <Stagger>                   : staggered reveal of direct children
 *  - <PageMotion>                : route-level page transition + automatic
 *                                  scroll reveals for any page content
 *
 * Everything is opt-out with `data-no-motion` on an element or any ancestor.
 */
import { useLayoutEffect, useRef, createElement } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(SplitText, ScrollTrigger);

export const EASE = 'power3.out';

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function whenFontsReady(run) {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run).catch(run);
  } else {
    run();
  }
}

/* ------------------------------------------------------------------ */
/* RevealText — heading words slide up and fade in with a slight stagger */
/* ------------------------------------------------------------------ */
export function RevealText({
  as = 'h2',
  children,
  className = '',
  delay = 0,
  stagger = 0.055,
  duration = 0.9,
  scroll = true,
  ...rest
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1 });
      return undefined;
    }

    let ctx;
    let split;
    const run = () => {
      ctx = gsap.context(() => {
        split = new SplitText(el, { type: 'words', wordsClass: 'motion-word' });
        gsap.set(el, { opacity: 1 });
        gsap.from(split.words, {
          y: 32,
          opacity: 0,
          duration,
          delay,
          stagger,
          ease: EASE,
          scrollTrigger: scroll
            ? { trigger: el, start: 'top 88%', once: true }
            : undefined,
        });
      }, el);
    };
    whenFontsReady(run);

    return () => {
      if (split) split.revert();
      if (ctx) ctx.revert();
    };
  }, [delay, stagger, duration, scroll]);

  return createElement(
    as,
    { ref, className: `motion-pending ${className}`.trim(), ...rest },
    children,
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — one block fades and slides in when it enters the viewport   */
/* ------------------------------------------------------------------ */
export function Reveal({
  as = 'div',
  children,
  className = '',
  delay = 0,
  y = 24,
  duration = 0.8,
  ...rest
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return undefined;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [delay, y, duration]);

  return createElement(as, { ref, className, ...rest }, children);
}

/* ------------------------------------------------------------------ */
/* Stagger — direct children reveal one after another                   */
/* ------------------------------------------------------------------ */
export function Stagger({
  as = 'div',
  children,
  className = '',
  stagger = 0.09,
  y = 28,
  duration = 0.75,
  ...rest
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const items = Array.from(el.children);
    if (!items.length) return undefined;
    if (prefersReducedMotion()) {
      gsap.set(items, { opacity: 1, y: 0 });
      return undefined;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          stagger,
          ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [stagger, y, duration]);

  return createElement(as, { ref, className, ...rest }, children);
}

/* ------------------------------------------------------------------ */
/* Automatic page motion                                                */
/* ------------------------------------------------------------------ */

// Blocks that read as "content" on any page of the app.
const BLOCK_SELECTOR = [
  'h1', 'h2', 'h3',
  'p',
  'img',
  'form',
  'table',
  'blockquote',
  'section',
  '[data-motion]',
  '[class*="grid"] > *',
  '[class*="rounded-2xl"]',
  '[class*="rounded-3xl"]',
].join(',');

const SKIP_SELECTOR = '[data-no-motion], [data-no-motion] *, nav, nav *, header, header *, footer p, [role="dialog"], [role="dialog"] *';

const DONE_ATTR = 'data-motion-done';

function collectTargets(root) {
  const all = Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    el =>
      !el.hasAttribute(DONE_ATTR) &&
      !el.matches(SKIP_SELECTOR) &&
      el.offsetParent !== null,
  );
  const set = new Set(all);
  // Keep only the outermost block of any nested pair so cards animate as a unit.
  return all.filter(el => {
    let parent = el.parentElement;
    while (parent && parent !== root) {
      if (set.has(parent) || parent.hasAttribute(DONE_ATTR)) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

/**
 * Animates a page container: a short page-enter transition, word-by-word
 * reveals for top-level headings, and scroll-triggered fade-ups for
 * every other content block. Re-runs on every route change, and picks up
 * content that arrives later (fetched listings, dashboard tables, ...).
 */
export function usePageMotion(ref, routeKey) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || typeof window === 'undefined') return undefined;

    if (prefersReducedMotion()) {
      gsap.set(root, { opacity: 1, clearProps: 'transform' });
      return undefined;
    }

    let ctx;
    let observer;
    let pending;
    const splits = [];

    const animate = (isFirstPass) => {
      // Our own DOM writes (SplitText) must not re-trigger the observer.
      if (observer) observer.disconnect();
      const targets = collectTargets(root);
      if (!targets.length) {
        reconnect();
        return;
      }
      targets.forEach(el => el.setAttribute(DONE_ATTR, ''));

      const headings = [];
      const blocks = [];
      targets.forEach(el => {
        if (/^H[12]$/.test(el.tagName) && el.textContent.trim().length < 140) {
          headings.push(el);
        } else {
          blocks.push(el);
        }
      });

      headings.forEach((el, i) => {
        const split = new SplitText(el, { type: 'words', wordsClass: 'motion-word' });
        splits.push(split);
        gsap.from(split.words, {
          y: 30,
          opacity: 0,
          duration: 0.9,
          stagger: 0.05,
          ease: EASE,
          delay: isFirstPass && i === 0 ? 0.05 : 0,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });

      if (blocks.length) {
        // Batched so items sharing a viewport row come in together.
        ScrollTrigger.batch(blocks, {
          start: 'top 92%',
          once: true,
          onEnter: batch =>
            gsap.fromTo(
              batch,
              { opacity: 0, y: 26 },
              { opacity: 1, y: 0, duration: 0.75, stagger: 0.08, ease: EASE, overwrite: true },
            ),
        });
        gsap.set(blocks, { opacity: 0 });
      }

      ScrollTrigger.refresh();
      reconnect();
    };

    const reconnect = () => {
      if (observer && ref.current) {
        observer.observe(root, { childList: true, subtree: true });
      }
    };

    const run = () => {
      if (!ref.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          root,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        );

        animate(true);

        // Later-arriving content (async data) gets the same treatment.
        observer = new MutationObserver(() => {
          clearTimeout(pending);
          pending = setTimeout(() => {
            if (ref.current) ctx.add(() => animate(false));
          }, 120);
        });
        reconnect();
      }, root);
    };

    whenFontsReady(run);

    return () => {
      clearTimeout(pending);
      if (observer) observer.disconnect();
      splits.forEach(s => s.revert());
      if (ctx) ctx.revert();
    };
  }, [ref, routeKey]);
}


/** Wraps page content and applies `usePageMotion`. */
export function PageMotion({ children, className = '' }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  usePageMotion(ref, pathname);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default PageMotion;
