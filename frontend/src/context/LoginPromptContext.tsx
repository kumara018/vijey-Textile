'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface LoginPromptContextType {
  promptLogin: (message?: string) => void;
  isOpen: boolean;
  message: string;
  close: () => void;
}

const LoginPromptContext = createContext<LoginPromptContextType>({
  promptLogin: () => {},
  isOpen: false,
  message: '',
  close: () => {},
});

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [message, setMessage] = useState('');

  const promptLogin = useCallback((msg = '') => {
    setMessage(msg);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <LoginPromptContext.Provider value={{ promptLogin, isOpen, message, close }}>
      {children}
    </LoginPromptContext.Provider>
  );
}

export const useLoginPrompt = () => useContext(LoginPromptContext);
