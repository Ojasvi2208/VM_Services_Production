'use client';

import { useEffect, useCallback } from 'react';

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const ACTIVITY_KEY = 'lastActivityTime';

export default function SessionManager() {
  // Update last activity time
  const updateActivity = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
  }, []);

  // Check if session has expired
  const checkSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      
      if (lastActivity) {
        const timeSinceActivity = Date.now() - parseInt(lastActivity);
        
        if (timeSinceActivity > SESSION_TIMEOUT_MS) {
          // Session expired - clear state and reload
          console.log('Session expired after 1 hour of inactivity. Reloading...');
          localStorage.removeItem(ACTIVITY_KEY);
          
          // Clear any cached data
          sessionStorage.clear();
          
          // Reload the page fresh
          window.location.reload();
        }
      } else {
        // First visit - set initial activity time
        updateActivity();
      }
    }
  }, [updateActivity]);

  useEffect(() => {
    // Check session on mount
    checkSession();

    // Update activity on user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check session periodically (every 5 minutes)
    const intervalId = setInterval(checkSession, 5 * 60 * 1000);

    // Also check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSession, updateActivity]);

  // This component doesn't render anything
  return null;
}
