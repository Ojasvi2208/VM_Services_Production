'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// ─── SessionManager ───────────────────────────────────────────
// Mounted once at root (inside AuthProvider) — renders nothing.
//
// Responsibilities:
//   1. Track user activity (mouse, keyboard, scroll, touch, navigation)
//   2. After INACTIVITY_MS of silence → call logout() + redirect to /auth/signin
//   3. Show a 60-second warning overlay before logging out
//   4. On tab visibility restore → immediately re-check elapsed time
//   5. Only runs the inactivity clock when a user is authenticated;
//      does nothing for anonymous visitors.
//
// Cookie-based sessions persist across page navigations (server-side)
// so this is purely a client-side idle guard layered on top.
// ─────────────────────────────────────────────────────────────

const INACTIVITY_MS   = 5 * 60 * 1000;  // 5 minutes
const WARNING_MS      = 4 * 60 * 1000;  // warn at 4 minutes
const ACTIVITY_KEY    = 'vmfs_last_activity';
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'popstate'] as const;

export default function SessionManager() {
  const { user, isAuthenticated, logout } = useAuth();

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningEl       = useRef<HTMLDivElement | null>(null);
  const countdown       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ─────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)    clearTimeout(warningTimer.current);
    if (countdown.current)       clearInterval(countdown.current);
    inactivityTimer.current = null;
    warningTimer.current    = null;
    countdown.current       = null;
  }, []);

  const hideWarning = useCallback(() => {
    if (warningEl.current) {
      warningEl.current.remove();
      warningEl.current = null;
    }
    if (countdown.current) {
      clearInterval(countdown.current);
      countdown.current = null;
    }
  }, []);

  const doLogout = useCallback(async () => {
    hideWarning();
    clearTimers();
    localStorage.removeItem(ACTIVITY_KEY);
    sessionStorage.clear();
    await logout();
    window.location.href = '/auth/signin?reason=idle';
  }, [logout, clearTimers, hideWarning]);

  const showWarning = useCallback(() => {
    if (warningEl.current) return; // already visible

    const el = document.createElement('div');
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Session expiry warning');
    el.style.cssText = [
      'position:fixed;bottom:24px;right:24px;z-index:99999',
      'background:#161d1a;border:1px solid rgba(68,245,147,0.25)',
      'border-radius:16px;padding:20px 24px;width:320px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
      'font-family:Inter,sans-serif;color:#dce5df',
      'animation:vmfsSlideIn 0.3s ease',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      @keyframes vmfsSlideIn {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    let secs = 60;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:20px">⏳</span>
        <strong style="font-family:Space Grotesk,sans-serif;font-size:14px">Session expiring soon</strong>
      </div>
      <p style="font-size:13px;color:#859586;margin:0 0 14px;line-height:1.5">
        You've been inactive. Signing you out in
        <strong id="vmfs-cd" style="color:#44f593">${secs}s</strong>.
      </p>
      <div style="display:flex;gap:8px">
        <button id="vmfs-stay"
          style="flex:1;padding:8px;border-radius:10px;border:none;cursor:pointer;
                 background:linear-gradient(to right,#44f593,#00d87a);
                 color:#00391c;font-weight:700;font-size:13px">
          Stay logged in
        </button>
        <button id="vmfs-out"
          style="padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);
                 cursor:pointer;background:transparent;color:#859586;font-size:13px">
          Sign out
        </button>
      </div>
    `;

    document.body.appendChild(el);
    warningEl.current = el;

    const cdEl = el.querySelector('#vmfs-cd') as HTMLElement;
    countdown.current = setInterval(() => {
      secs -= 1;
      if (cdEl) cdEl.textContent = `${secs}s`;
    }, 1000);

    el.querySelector('#vmfs-stay')?.addEventListener('click', () => {
      hideWarning();
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      scheduleTimers(); // restart the full 5-min clock
    });

    el.querySelector('#vmfs-out')?.addEventListener('click', doLogout);
  }, [hideWarning, doLogout]); // scheduleTimers added below

  // Forward-ref trick: scheduleTimers needs showWarning, showWarning needs scheduleTimers
  const scheduleTimers = useCallback(() => {
    clearTimers();
    // Warning at 4 minutes
    warningTimer.current = setTimeout(showWarning, WARNING_MS);
    // Hard logout at 5 minutes
    inactivityTimer.current = setTimeout(doLogout, INACTIVITY_MS);
  }, [clearTimers, showWarning, doLogout]);

  const recordActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    if (isAuthenticated) {
      hideWarning();
      scheduleTimers();
    }
  }, [isAuthenticated, hideWarning, scheduleTimers]);

  // ── Re-check when tab regains focus (catches away-from-keyboard) ──
  const onVisibilityChange = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const last = parseInt(localStorage.getItem(ACTIVITY_KEY) ?? '0', 10);
    const elapsed = Date.now() - last;
    if (isAuthenticated && elapsed >= INACTIVITY_MS) {
      doLogout();
    } else if (isAuthenticated && elapsed >= WARNING_MS && !warningEl.current) {
      showWarning();
    }
  }, [isAuthenticated, doLogout, showWarning]);

  // ── Effect: start/stop clock based on auth state ────────────
  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      hideWarning();
      localStorage.removeItem(ACTIVITY_KEY);
      return;
    }

    // User is authenticated — seed activity timestamp and start clock
    if (!localStorage.getItem(ACTIVITY_KEY)) {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
    scheduleTimers();

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, recordActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimers();
      hideWarning();
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, recordActivity)
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]); // restart when user identity changes

  return null;
}
