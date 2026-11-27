export const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

export function apiFetch(url, options) {
  if (import.meta.env.VITE_API_PENDING) {
    return Promise.reject(new Error("The preview service desk is awaiting its test API connection."));
  }
  return fetch(url, options);
}
