'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Convention, directionColors, DirectionColors } from './tokens';

interface ConventionValue {
  convention: Convention;
  colors: DirectionColors;
  setConvention: (c: Convention) => void;
}

const ConventionContext = createContext<ConventionValue>({
  convention: 'KR',
  colors: directionColors('KR'),
  setConvention: () => {},
});

export function ConventionProvider({ children }: { children: ReactNode }) {
  const [convention, setConventionState] = useState<Convention>('KR');

  const setConvention = useCallback((next: Convention) => {
    setConventionState(next);
    try {
      window.localStorage.setItem('gyeopchyeo:convention', next);
    } catch {
      // 저장 실패는 무시 — 표시 관설은 세션 단위로만 유지된다
    }
  }, []);

  return (
    <ConventionContext.Provider
      value={{ convention, colors: directionColors(convention), setConvention }}
    >
      {children}
    </ConventionContext.Provider>
  );
}

export function useConvention() {
  return useContext(ConventionContext);
}
