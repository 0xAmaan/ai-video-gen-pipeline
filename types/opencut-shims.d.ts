declare module "@opencut/auth" {
  const auth: any;
  export { auth };
  export default auth;
}

declare module "@opencut/auth/keys" {
  export function keys(): Record<string, unknown>;
}

declare module "@opencut/auth/client" {
  type AuthResponse = Promise<{ error?: { message?: string } }>;
  export const signIn: {
    email: (params: any) => AuthResponse;
    social: (params: any) => Promise<unknown>;
  };
  export const signUp: {
    email: (params: any) => AuthResponse;
    social?: (params: any) => Promise<unknown>;
  };
}

declare module "@opencut/db" {
  const db: any;
  export { db };
  export const exportWaitlist: any;
  export const eq: any;
  export default db;
}

declare module "@opencut/db/keys" {
  export function keys(): Record<string, unknown>;
}
