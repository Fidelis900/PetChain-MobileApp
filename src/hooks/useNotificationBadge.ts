/**
 * useNotificationBadge
 *
 * Returns the current unread notification count and a refresh function.
 * Polls on mount and whenever `refresh()` is called (e.g. after navigation focus).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { getUnreadCount } from '../services/notificationStore';

export function useNotificationBadge(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    getUnreadCount()
      .then((n) => {
        if (isMounted.current) setCount(n);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}
