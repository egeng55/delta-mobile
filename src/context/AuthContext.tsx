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
  ReactNode,
} from 'react';
import { supabase } from '../services/supabase';
import { invalidateIntelligenceCache } from '../services/api';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

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

  // Initialize and listen to auth state changes
  useEffect(() => {
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

        setState({
          isLoading: false,
          isAuthenticated: session !== null,
          user: toUser(session?.user ?? null),
          session: session,
        });
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
        setState({
          isLoading: false,
          isAuthenticated: session !== null,
          user: toUser(session?.user ?? null),
          session: session,
        });
      }
    );

    return () => {
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
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            username: username,
            age: age,
            gender: gender,
          },
        },
      });

      if (error !== null) {
        return { success: false, error: error.message };
      }

      if (data.user === null) {
        return { success: false, error: 'Signup failed' };
      }

      // Create profile row in Supabase (upsert to handle race conditions with triggers)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: email,
          name: name,
          username: username ?? null,
          age: age ?? null,
          gender: gender ?? null,
          role: 'user',
        }, {
          onConflict: 'id',
        });

      if (profileError !== null) {
        console.error('Error creating profile:', profileError.message);
        // Don't fail signup if profile creation fails - user can still use the app
      }

      // Check if email confirmation is required
      if (data.session === null) {
        return { success: true };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      return { success: false, error: message };
    }
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

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      invalidateIntelligenceCache();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors, state will be reset by listener
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
