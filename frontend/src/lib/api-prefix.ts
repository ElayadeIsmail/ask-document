const fallback = "/api/v1";

function trim(value: string | undefined) {
  const prefix = (value || fallback).trim().replace(/\/$/, "");
  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}

export const API_PREFIX = trim(process.env.NEXT_PUBLIC_API_PREFIX);

export function apiPath(path = "") {
  if (!path) return API_PREFIX;
  return `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}
