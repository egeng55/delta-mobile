/**
 * AuthContext - Manages authentication state with Supabase.
 *
 * SAFETY DECISIONS:
 * - All boolean state is explicitly typed and initialized
 * - No implicit truthiness checks
 * - Supabase handles session persistence
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { supabase } from '../services/supabase';
import { invalidateIntelligenceCache } from '../services/api';
import { avatarService } from '../services/avatarService';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { accountIsApproved } from '../services/accountAdmission';

// User type for our app
export interface User {
  id: string;
  email: string;
  name: string;
}

// Auth state - all booleans are explicit
interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}

// Context type
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string, username?: string, age?: number, gender?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// Initial state
const initialState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  session: null,
};

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Hook to use auth context.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Helper to convert Supabase user to our User type
function toUser(supabaseUser: SupabaseUser | null): User | null {
  if (supabaseUser === null) {
    return null;
  }
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: supabaseUser.user_metadata?.name ?? supabaseUser.email?.split('@')[0] ?? 'User',
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth provider component with Supabase integration.
 */
export function AuthProvider({ children }: AuthProviderProps): React.ReactNode {
  const [state, setState] = useState<AuthState>(initialState);
  const authRevision = useRef(0);

  // Initialize and listen to auth state changes
  useEffect(() => {
    let disposed = false;
    const initialRevision = authRevision.current;
    const acceptSession = async (session: Session | null) => {
      const current = ++authRevision.current;
      setState({ ...initialState, isLoading: session !== null });
      const approved = session && !session.user.is_anonymous && session.user.email_confirmed_at
        ? await accountIsApproved(session.access_token, session.user.id) : false;
      if (disposed || current !== authRevision.current) return;
      setState({ isLoading: false, isAuthenticated: Boolean(approved), user: approved ? toUser(session!.user) : null, session: approved ? session : null });
    };
    // Get initial session
    const initSession = async (): Promise<void> => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error !== null) {
          console.error('Error getting session:', error.message);
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            session: null,
          });
          return;
        }

        if (authRevision.current === initialRevision && !disposed) await acceptSession(session);
      } catch {
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          session: null,
        });
      }
    };

    initSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void acceptSession(session);
      }
    );

    return () => {
      disposed = true;
      authRevision.current += 1;
      subscription?.unsubscribe?.();
    };
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    name: string,
    username?: string,
    age?: number,
    gender?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return { success: false, error: 'An approved Delta invitation is required. Request access on the Delta website.' };
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error !== null) {
        return { success: false, error: error.message };
      }

      if (data.session === null) {
        return { success: false, error: 'Login failed' };
      }

      if (!await accountIsApproved(data.session.access_token, data.session.user.id)) {
        await supabase.auth.signOut({ scope: 'local' });
        return { success: false, error: 'Approved access could not be verified. Try again when connected or contact your administrator.' };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    authRevision.current += 1;
    setState({ ...initialState, isLoading: false });
    try {
      invalidateIntelligenceCache();
      avatarService.clearCache();
      await supabase.auth.signOut();
    } catch {
      // Local UI stays signed out even if remote revocation is unavailable.
    }
  }, []);

  const contextValue: AuthContextType = {
    isLoading: state.isLoading === true,
    isAuthenticated: state.isAuthenticated === true,
    user: state.user,
    session: state.session,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
