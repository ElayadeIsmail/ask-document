import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { apiPath } from "@/lib/api-prefix";
import { SESSION_COOKIE } from "@/lib/cookie";
import { apiUrl } from "@/lib/server-api";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");
  headers.delete("content-length");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const target = `${apiUrl()}${apiPath(`/${path.join("/")}`)}${request.nextUrl.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    cache: "no-store",
  } as RequestInit);

  if (upstream.status === 401) {
    (await cookies()).delete(SESSION_COOKIE);
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) responseHeaders.set("content-type", contentType);
  if (disposition) responseHeaders.set("content-disposition", disposition);
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
