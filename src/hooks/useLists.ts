import { useCallback, useEffect, useState } from 'preact/hooks';
import { getLists, getMemberships } from '../db';
import type { CacheListInfo } from '../types';

const KEY = 'dosenfinder.activeList';

function loadActive(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export interface ListsState {
  lists: CacheListInfo[];
  /** Cache-Code → Listen-IDs */
  memberships: Map<string, string[]>;
  /** '' = alle Caches */
  active: string;
  setActive: (id: string) => void;
  reload: () => Promise<void>;
  /** Liegt der Cache in der aktiven Liste? (true, wenn keine Liste gewählt) */
  inActive: (code: string) => boolean;
  countFor: (id: string) => number;
}

/** Eigene Listen und die gewählte Liste – gemeinsam für Cache-Liste und Karte. */
export function useLists(): ListsState {
  const [lists, setLists] = useState<CacheListInfo[]>([]);
  const [memberships, setMemberships] = useState<Map<string, string[]>>(new Map());
  const [active, setActiveState] = useState(loadActive);

  const reload = useCallback(async () => {
    const [l, m] = await Promise.all([getLists(), getMemberships()]);
    setLists(l);
    setMemberships(m);
    // Gelöschte Liste nicht weiter als aktiv führen
    setActiveState((a) => {
      if (a && !l.some((x) => x.id === a)) {
        try {
          localStorage.setItem(KEY, '');
        } catch {
          /* ignorieren */
        }
        return '';
      }
      return a;
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setActive = (id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignorieren */
    }
    setActiveState(id);
  };

  const inActive = (code: string) => !active || (memberships.get(code)?.includes(active) ?? false);
  const countFor = (id: string) => {
    let n = 0;
    for (const ids of memberships.values()) if (ids.includes(id)) n++;
    return n;
  };

  return { lists, memberships, active, setActive, reload, inActive, countFor };
}
