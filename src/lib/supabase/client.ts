// Lightweight Supabase client using fetch (no native dependencies)
// Works with React Native without additional packages

import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const AUTH_STORAGE_KEY = "supabase_auth_session";

// Fail fast if env vars are missing (prevents accidental calls to the Vercel host)
if (!SUPABASE_URL) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

interface AuthResponse {
  session: Session | null;
  user: User | null;
  error?: { message: string };
}

class SupabaseAuth {
  private session: Session | null = null;
  private listeners: Array<(session: Session | null) => void> = [];

  async initialize(): Promise<Session | null> {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        this.session = JSON.parse(stored);
        // Check if session is expired
        if (this.session && this.session.expires_at * 1000 < Date.now()) {
          await this.refreshSession();
        }
      }
    } catch {
      this.session = null;
    }
    return this.session;
  }

  private async saveSession(session: Session | null): Promise<void> {
    this.session = session;
    if (session) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
    this.listeners.forEach((listener) => listener(session));
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  getSession(): Session | null {
    return this.session;
  }

  getUser(): User | null {
    return this.session?.user ?? null;
  }

  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          session: null,
          user: null,
          error: { message: data.error_description || data.msg || "Signup failed" },
        };
      }

      if (data.access_token) {
        const session: Session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
          user: data.user,
        };
        await this.saveSession(session);
        return { session, user: data.user };
      }

      return { session: null, user: data.user };
    } catch (error) {
      return {
        session: null,
        user: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          session: null,
          user: null,
          error: { message: data.error_description || data.msg || "Login failed" },
        };
      }

      const session: Session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        user: data.user,
      };

      await this.saveSession(session);
      return { session, user: data.user };
    } catch (error) {
      return {
        session: null,
        user: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async signInWithOAuth(provider: "apple" | "google"): Promise<string> {
    // Returns the URL to open in browser for OAuth
    const redirectUrl = `${SUPABASE_URL}/auth/v1/callback`;
    return `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUrl
    )}`;
  }

  async refreshSession(): Promise<AuthResponse> {
    if (!this.session?.refresh_token) {
      return { session: null, user: null, error: { message: "No refresh token" } };
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });

      const data = await response.json();

      if (!response.ok) {
        await this.saveSession(null);
        return {
          session: null,
          user: null,
          error: { message: data.error_description || "Refresh failed" },
        };
      }

      const session: Session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        user: data.user,
      };

      await this.saveSession(session);
      return { session, user: data.user };
    } catch (error) {
      return {
        session: null,
        user: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async signOut(): Promise<void> {
    if (this.session?.access_token) {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });
      } catch {
        // Ignore errors during logout
      }
    }
    await this.saveSession(null);
  }

  async resetPasswordForEmail(email: string): Promise<{ error?: { message: string } }> {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: { message: data.error_description || "Reset failed" } };
      }

      return {};
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Network error" } };
    }
  }
}

class SupabaseDB {
  private auth: SupabaseAuth;

  constructor(auth: SupabaseAuth) {
    this.auth = auth;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Prefer: "return=representation",
    };

    const session = this.auth.getSession();
    if (session?.access_token) {
      // @ts-expect-error HeadersInit can be a record
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  from(table: string): SupabaseQueryBuilder {
    return new SupabaseQueryBuilder(table, this.getHeaders.bind(this));
  }
}

class SupabaseQueryBuilder {
  private table: string;
  private getHeaders: () => HeadersInit;
  private filters: string[] = [];
  private selectColumns = "*";
  private orderColumn?: string;
  private orderAsc = true;
  private limitCount?: number;
  private isSingle = false;

  constructor(table: string, getHeaders: () => HeadersInit) {
    this.table = table;
    this.getHeaders = getHeaders;
  }

  select(columns = "*"): this {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: string | number | boolean): this {
    this.filters.push(`${column}=eq.${value}`);
    return this;
  }

  neq(column: string, value: string | number | boolean): this {
    this.filters.push(`${column}=neq.${value}`);
    return this;
  }

  gt(column: string, value: string | number): this {
    this.filters.push(`${column}=gt.${value}`);
    return this;
  }

  gte(column: string, value: string | number): this {
    this.filters.push(`${column}=gte.${value}`);
    return this;
  }

  lt(column: string, value: string | number): this {
    this.filters.push(`${column}=lt.${value}`);
    return this;
  }

  lte(column: string, value: string | number): this {
    this.filters.push(`${column}=lte.${value}`);
    return this;
  }

  is(column: string, value: null): this {
    if (value === null) {
      this.filters.push(`${column}=is.null`);
    }
    return this;
  }

  not(column: string, operator: string, value: string | number | null): this {
    if (value === null) {
      this.filters.push(`${column}=not.is.null`);
    } else {
      this.filters.push(`${column}=not.${operator}.${value}`);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  private buildUrl(): string {
    let url = `${SUPABASE_URL}/rest/v1/${this.table}?select=${this.selectColumns}`;

    if (this.filters.length > 0) {
      url += "&" + this.filters.join("&");
    }

    if (this.orderColumn) {
      url += `&order=${this.orderColumn}.${this.orderAsc ? "asc" : "desc"}`;
    }

    if (this.limitCount !== undefined) {
      url += `&limit=${this.limitCount}`;
    }

    return url;
  }

  async execute<T>(): Promise<{ data: T | null; error: { message: string } | null }> {
    try {
      const response = await fetch(this.buildUrl(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: { message: errorData.message || "Query failed" },
        };
      }

      const data = await response.json();
      return {
        data: this.isSingle ? (data[0] ?? null) : data,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  // Alias for execute
  async then<T>(
    resolve: (result: { data: T | null; error: { message: string } | null }) => void
  ): Promise<void> {
    const result = await this.execute<T>();
    resolve(result);
  }

  async insert<T>(
    data: Record<string, unknown> | Array<Record<string, unknown>>
  ): Promise<{ data: T | null; error: { message: string } | null }> {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${this.table}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: { message: errorData.message || "Insert failed" },
        };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async update<T>(
    data: Record<string, unknown>
  ): Promise<{ data: T | null; error: { message: string } | null }> {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${this.table}`;
      if (this.filters.length > 0) {
        url += "?" + this.filters.join("&");
      }

      const response = await fetch(url, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: { message: errorData.message || "Update failed" },
        };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async upsert<T>(
    data: Record<string, unknown> | Array<Record<string, unknown>>,
    options?: { onConflict?: string }
  ): Promise<{ data: T | null; error: { message: string } | null }> {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${this.table}`;
      if (options?.onConflict) {
        url += `?on_conflict=${options.onConflict}`;
      }

      const headers = this.getHeaders() as Record<string, string>;
      headers.Prefer = "resolution=merge-duplicates,return=representation";

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: { message: errorData.message || "Upsert failed" },
        };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }

  async delete(): Promise<{ error: { message: string } | null }> {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${this.table}`;
      if (this.filters.length > 0) {
        url += "?" + this.filters.join("&");
      }

      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: { message: errorData.message || "Delete failed" } };
      }

      return { error: null };
    } catch (error) {
      return {
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }
}

class SupabaseFunctions {
  private auth: SupabaseAuth;

  constructor(auth: SupabaseAuth) {
    this.auth = auth;
  }

  async invoke<T>(
    functionName: string,
    options?: { body?: Record<string, unknown> }
  ): Promise<{ data: T | null; error: { message: string } | null }> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      };

      const session = this.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

      // TEMP debug: remove once confirmed
      console.log("[supabase.functions.invoke]", { functionName, url });

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const errorText = await response.text();
        return {
          data: null,
          error: { message: errorText || `HTTP ${response.status}` },
        };
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        return {
          data: null,
          error: { message: `Expected JSON, got ${contentType}. Body: ${text}` },
        };
      }

      const data = await response.json();
      return { data: data as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Network error" },
      };
    }
  }
}

// Create singleton instance
const auth = new SupabaseAuth();
const db = new SupabaseDB(auth);
const functions = new SupabaseFunctions(auth);

export const supabase = {
  auth,
  from: db.from.bind(db),
  functions,
};

// Initialize auth on import
auth.initialize();