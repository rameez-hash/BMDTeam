'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Hook that returns server-synced time instead of local system time.
 * Fetches server time once on mount (and every 10 min), calculates offset,
 * then ticks every second using the offset.
 */
export function useServerTime() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const offsetRef = useRef(0); // ms: server - local

  useEffect(() => {
    let mounted = true;

    async function syncTime() {
      try {
        const t1 = Date.now();
        const res = await fetch('/api/server-time');
        const data = await res.json();
        const t2 = Date.now();
        const roundTrip = (t2 - t1) / 2;
        const serverMs = new Date(data.serverTime).getTime();
        offsetRef.current = serverMs - (t1 + roundTrip);
        if (mounted) {
          setCurrentTime(new Date(Date.now() + offsetRef.current));
        }
      } catch (e) {
        console.error('Failed to sync server time:', e);
        offsetRef.current = 0;
      }
    }

    syncTime();

    // Tick every second using offset
    const ticker = setInterval(() => {
      if (mounted) {
        setCurrentTime(new Date(Date.now() + offsetRef.current));
      }
    }, 1000);

    // Re-sync every 10 minutes
    const reSync = setInterval(syncTime, 10 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(ticker);
      clearInterval(reSync);
    };
  }, []);

  return currentTime;
}
