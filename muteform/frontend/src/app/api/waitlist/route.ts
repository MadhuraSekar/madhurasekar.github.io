import { NextResponse } from 'next/server'

// Simple in-memory waitlist for MVP (resets on deploy)
const waitlist = new Set<string>()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = (body.email || '').trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (waitlist.has(email)) {
      return NextResponse.json({ error: 'Already on the waitlist', count: waitlist.size }, { status: 409 })
    }

    waitlist.add(email)

    return NextResponse.json({
      success: true,
      count: waitlist.size + 347, // baseline count for demo
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ count: waitlist.size + 347 })
}
