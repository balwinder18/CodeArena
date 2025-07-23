import { NextResponse } from 'next/server';
import axios from 'axios';


async function createBatchSubmissions(submissions) {
    return axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions/batch?base64_encoded=false',
        { submissions },
        {
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            },
        }
    );
}

async function getBatchSubmissions(tokens) {
    const tokenString = tokens.map(t => t.token).join(',');
    let allDone = false;
    let submissionResults;

    while (!allDone) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await axios.get(
            `https://judge0-ce.p.rapidapi.com/submissions/batch?tokens=${tokenString}&base64_encoded=false&fields=status,stdout,stderr,compile_output`,
            {
                headers: {
                    'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                },
            }
        );

        submissionResults = response.data.submissions;
        if (!submissionResults.some(r => r.status.id <= 2)) {
            allDone = true;
        }
    }
    return submissionResults;
}

export async function POST(req) {
    try {
        const { source_code, language_id, testCases } = await req.json();

        if (!source_code || !language_id || !testCases || !Array.isArray(testCases)) {
            return NextResponse.json({ error: 'Missing required fields for submission.' }, { status: 400 });
        }

        const submissions = testCases.map(tc => ({
            source_code,
            language_id,
            stdin: Array.isArray(tc.input) ? tc.input.join('\n') : String(tc.input),
            expected_output: String(tc.expectedOutput),
        }));

        const createResponse = await createBatchSubmissions(submissions);
        const tokens = createResponse.data;

        const results = await getBatchSubmissions(tokens);

        let passedCount = 0;
        results.forEach((result, index) => {
            const actualOutput = result.stdout ? result.stdout.trim() : '';
            const expectedOutput = String(testCases[index].expectedOutput).trim();

            if (result.status.id === 3 && actualOutput === expectedOutput) {
                passedCount++;
            }
        });

        return NextResponse.json({
            passedCount,
            totalCount: testCases.length,
            results 
        });

    } catch (err) {
        console.error("Error in /api/submit:", err.response ? err.response.data : err.message);
        const errorData = err.response ? err.response.data : { message: 'An internal server error occurred.' };
        return NextResponse.json({ error: 'Failed to process submission batch.', details: errorData }, { status: 500 });
    }
}
