import { NextResponse } from 'next/server';
import axios from 'axios';

// This function sends a batch of submissions to Judge0
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

// This function polls Judge0 to get the results of the batch submission
async function getBatchSubmissions(tokens) {
    const tokenString = tokens.map(t => t.token).join(',');
    let allDone = false;
    let submissionResults;

    // Keep checking the status until all submissions are processed (i.e., not "In Queue" or "Processing")
    while (!allDone) {
        // Wait for a second before polling again to avoid rate-limiting
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
        
        // Check if any submission is still in the queue or processing
        if (!submissionResults.some(r => r.status.id <= 2)) {
            allDone = true;
        }
    }
    return submissionResults;
}

export async function POST(req) {
    try {
        const { source_code, language_id, testCases } = await req.json();

        // Basic validation
        if (!source_code || !language_id || !testCases || !Array.isArray(testCases)) {
            return NextResponse.json({ error: 'Missing required fields for submission.' }, { status: 400 });
        }

        // 1. Format submissions for Judge0 batch API
        const submissions = testCases.map(tc => ({
            source_code,
            language_id,
            stdin: Array.isArray(tc.input) ? tc.input.join('\n') : String(tc.input),
            expected_output: String(tc.expectedOutput),
        }));

        // 2. Create the batch submission and get the tokens
        const createResponse = await createBatchSubmissions(submissions);
        const tokens = createResponse.data;

        // 3. Poll for the results using the tokens
        const results = await getBatchSubmissions(tokens);

        // 4. Compare results and count passed tests
        let passedCount = 0;
        results.forEach((result, index) => {
            // Trim whitespace from stdout for accurate comparison
            const actualOutput = result.stdout ? result.stdout.trim() : '';
            const expectedOutput = String(testCases[index].expectedOutput).trim();

            // Status ID 3 means "Accepted"
            if (result.status.id === 3 && actualOutput === expectedOutput) {
                passedCount++;
            }
        });

        // 5. Return the final count
        return NextResponse.json({
            passedCount,
            totalCount: testCases.length,
            results // Optionally return full results for debugging
        });

    } catch (err) {
        console.error("Error in /api/submit:", err.response ? err.response.data : err.message);
        const errorData = err.response ? err.response.data : { message: 'An internal server error occurred.' };
        return NextResponse.json({ error: 'Failed to process submission batch.', details: errorData }, { status: 500 });
    }
}
