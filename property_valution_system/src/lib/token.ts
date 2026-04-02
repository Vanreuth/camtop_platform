const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const COOKIE_BASE = "path=/; samesite=lax";
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const AUTH_TOKEN_EVENT = "auth:token";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function setCookie(name: string, value: string | null, maxAge?: number) {
  if (typeof document === "undefined") return;

  if (!value) {
    document.cookie = `${name}=; Max-Age=0; ${COOKIE_BASE}`;
    return;
  }

  const maxAgePart = typeof maxAge === "number" ? ` Max-Age=${maxAge};` : "";
  document.cookie = `${name}=${encodeURIComponent(value)};${maxAgePart} ${COOKIE_BASE}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) return decodeURIComponent(rest.join("="));
  }

  return null;
}

function getFromSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(key);
}

function getFromLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function setInSession(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (!value) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, value);
}

function setInLocal(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (!value) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function dispatchAccessTokenEvent(token: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT, { detail: token }));
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return (
    memoryAccessToken ??
    getFromSession(ACCESS_KEY) ??
    getFromLocal(ACCESS_KEY) ??
    getCookie(ACCESS_KEY)
  );
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return (
    memoryRefreshToken ??
    getFromSession(REFRESH_KEY) ??
    getFromLocal(REFRESH_KEY) ??
    getCookie(REFRESH_KEY)
  );
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;

  memoryAccessToken = token;
  setInSession(ACCESS_KEY, token);
  setInLocal(ACCESS_KEY, token);
  setCookie(ACCESS_KEY, token, ACCESS_COOKIE_MAX_AGE);
  dispatchAccessTokenEvent(token);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;

  memoryRefreshToken = token;
  setInSession(REFRESH_KEY, token);
  setInLocal(REFRESH_KEY, token);
  setCookie(REFRESH_KEY, token, REFRESH_COOKIE_MAX_AGE);
}

export function clearTokens() {
  if (typeof window === "undefined") return;

  memoryAccessToken = null;
  memoryRefreshToken = null;
  setInSession(ACCESS_KEY, null);
  setInSession(REFRESH_KEY, null);
  setInLocal(ACCESS_KEY, null);
  setInLocal(REFRESH_KEY, null);
  setCookie(ACCESS_KEY, null);
  setCookie(REFRESH_KEY, null);
  dispatchAccessTokenEvent(null);
}

export function hydrateAccessTokenFromStorage() {
  if (typeof window === "undefined") return;

  memoryAccessToken =
    getFromSession(ACCESS_KEY) ?? getFromLocal(ACCESS_KEY) ?? getCookie(ACCESS_KEY);
  memoryRefreshToken =
    getFromSession(REFRESH_KEY) ?? getFromLocal(REFRESH_KEY) ?? getCookie(REFRESH_KEY);

  setInSession(ACCESS_KEY, memoryAccessToken);
  setInSession(REFRESH_KEY, memoryRefreshToken);
  setInLocal(ACCESS_KEY, memoryAccessToken);
  setInLocal(REFRESH_KEY, memoryRefreshToken);
  setCookie(ACCESS_KEY, memoryAccessToken, ACCESS_COOKIE_MAX_AGE);
  setCookie(REFRESH_KEY, memoryRefreshToken, REFRESH_COOKIE_MAX_AGE);
}
