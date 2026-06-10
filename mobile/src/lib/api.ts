import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "../config";

export type ApiError = {
  status: number;
  body: unknown;
};

// "ios" | "android" | "web" — lets the server record which platform a resident
// is using (powers the admin Usage dashboard).
const CLIENT_PLATFORM = Capacitor.getPlatform();

export async function apiFetch(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers);
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  finalHeaders.set("X-Client-Platform", CLIENT_PLATFORM);
  if (rest.body && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  return fetch(url, { ...rest, headers: finalHeaders });
}
