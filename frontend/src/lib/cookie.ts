export const SESSION_COOKIE = "askdoc_session";
export const COLLECTION_COOKIE = "askdoc_collection";

export const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export function rememberCollection(id: string) {
  document.cookie = `${COLLECTION_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
