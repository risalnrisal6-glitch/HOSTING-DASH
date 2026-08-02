"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import useSWR from "swr";
import { get, post } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<{ needsTwoFactor: boolean; userId?: string; tempToken?: string }>;
  completeTwoFactor: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const { data: user, mutate, isLoading } = useSWR<User | null>("/users/me", (url) => get<User>(url), {
    revalidateOnFocus: false,
    refreshInterval: 60000,
    onSuccess: () => setIsReady(true),
    onError: () => setIsReady(true),
  });

  useEffect(() => {
    setIsReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const result = await post<{ needsTwoFactor: boolean; userId?: string; tempToken?: string }>("/auth/login", { email, password });
    if (!result.needsTwoFactor) await mutate();
    return result;
  };

  const completeTwoFactor = async (tempToken: string, code: string) => {
    await post("/auth/two-factor", { tempToken, code });
    await mutate();
  };

  const logout = async () => {
    await post("/auth/logout").catch(() => undefined);
    await mutate(undefined as never, { revalidate: false });
  };

  const refresh = async () => {
    await mutate();
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, isReady, login, completeTwoFactor, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns true once the user is confirmed present (after loading settles). */
export function useIsAuthed(): boolean {
  const { user, isLoading } = useAuth();
  return !isLoading && !!user;
}
