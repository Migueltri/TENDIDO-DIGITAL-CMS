import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Author, SystemRole } from '../types';
import { getAuthors } from '../services/dataService';

interface AuthContextType {
  currentUser: Author | null;
  login: (authorId: string) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Author | null>(null);

  // Simular persistencia de sesión simple
  useEffect(() => {
    const storedUserId = localStorage.getItem('td_current_user_id');
    if (storedUserId) {
      const authors = getAuthors();
      const user = authors.find(a => a.id === storedUserId);
      if (user) setCurrentUser(user);
    } else {
        // Default login as first admin for demo purposes
        const authors = getAuthors();
        if(authors.length > 0) {
            setCurrentUser(authors[0]);
        }
    }
  }, []);

  const login = (authorId: string) => {
    const authors = getAuthors();
    const user = authors.find(a => a.id === authorId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('td_current_user_id', user.id);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('td_current_user_id');
  };

  const isAdmin = currentUser?.systemRole === 'ADMIN';

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};