import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  const { source_code, language_id, stdin } = await req.json();

  try {
    const submissionRes = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
      {
        source_code,
        language_id,
        stdin,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
      }
    );

    return NextResponse.json(submissionRes.data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
