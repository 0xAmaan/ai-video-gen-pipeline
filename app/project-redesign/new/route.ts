import { NextResponse } from "next/server";

const destination = "/project-redesign/input";

export async function GET(request: Request) {
  const url = new URL(destination, request.url);
  return NextResponse.redirect(url, { status: 307 });
}

export async function POST(request: Request) {
  const url = new URL(destination, request.url);
  return NextResponse.redirect(url, { status: 307 });
}
