import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.AIYU_API_URL || "http://localhost:3000";
const API_KEY = process.env.AIYU_API_KEY || "";

function buildHeaders(request: NextRequest, method: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  const ct = request.headers.get("content-type");
  if (ct && method !== "GET") {
    headers["content-type"] = ct;
  }
  return headers;
}

async function proxy(request: NextRequest, method: string) {
  const path = (request.nextUrl.pathname || "").replace(/^\/api\/?/, "");
  if (!path) {
    return NextResponse.json({ error: "Missing API path" }, { status: 400 });
  }
  const url = `${API_URL}/${path}${request.nextUrl.search}`;

  try {
    const opts: RequestInit = { method, headers: buildHeaders(request, method) };
    if (method !== "GET" && method !== "HEAD") {
      opts.body = await request.text();
    }
    const res = await fetch(url, opts);
    const contentType = res.headers.get("content-type") || "application/json";
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "PROXY_ERROR", message: `API server unreachable at ${API_URL}` } },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxy(request, "POST");
}

export async function PUT(request: NextRequest) {
  return proxy(request, "PUT");
}

export async function DELETE(request: NextRequest) {
  return proxy(request, "DELETE");
}
