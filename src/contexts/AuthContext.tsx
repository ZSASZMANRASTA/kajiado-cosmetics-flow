import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User } from '@/lib/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: 'admin' | 'cashier' | null;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'kajiadoCosmetics_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const userData = JSON.parse(sessionData);
      setUser(userData);
      setUserRole(userData.role);
      setIsSuperAdmin(userData.isSuperAdmin || false);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const user = await db.users
        .where('email')
        .equals(email.toLowerCase())
        .first();

      if (!user) {
        return { error: { message: 'Invalid email or password' } };
      }

      const isValid = await db.verifyPassword(password, user.password);

      if (!isValid) {
        return { error: { message: 'Invalid email or password' } };
      }

      const sessionUser = { ...user };
      delete sessionUser.password;

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      setUserRole(user.role);
      setIsSuperAdmin(user.isSuperAdmin || false);

      return { error: null };
    } catch (error) {
      return { error: { message: 'An error occurred during sign in' } };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setUserRole(null);
    setIsSuperAdmin(false);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, userRole, isSuperAdmin }}>
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
