import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { useNewAuth } from './NewAuthContext';

interface DraftState { dirty: boolean; saving: boolean }

const AssessmentDraftContext = createContext<{
  setDraftState: (state: DraftState) => void;
  confirmLeave: () => boolean;
}>({
  setDraftState: () => {},
  confirmLeave: () => true,
});

export function AssessmentDraftProvider({ children }: { children: ReactNode }) {
  const { user } = useNewAuth();
  const [state, setState] = useState<DraftState>({ dirty: false, saving: false });
  const stateRef = useRef(state);
  const setDraftState = useCallback((next: DraftState) => {
    stateRef.current = next;
    setState(previous => previous.dirty === next.dirty && previous.saving === next.saving ? previous : next);
  }, []);
  const confirmLeave = useCallback(() => {
    if (stateRef.current.saving) {
      window.alert('正在保存能力评估，请等待保存结果后再离开。');
      return false;
    }
    return !stateRef.current.dirty || window.confirm('能力评估还有未保存修改。离开将丢弃这些修改，确定离开吗？');
  }, []);

  // Logout has its own confirmation; do not block the subsequent unauthenticated redirect.
  const blocker = useBlocker(Boolean(user) && (state.dirty || state.saving));
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (confirmLeave()) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, confirmLeave]);

  useEffect(() => {
    if (!state.dirty && !state.saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state.dirty, state.saving]);

  return (
    <AssessmentDraftContext.Provider value={{ setDraftState, confirmLeave }}>
      {children}
    </AssessmentDraftContext.Provider>
  );
}

export const useAssessmentDraft = () => useContext(AssessmentDraftContext);
