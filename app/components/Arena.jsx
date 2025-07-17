import React, { useRef, useEffect } from 'react';


const PROBLEMS = [
    {
        id: 'sumTwoNumbers',
        title: "Sum of Two Numbers",
        description: "Write a function that takes two numbers, `a` and `b`, and returns their sum.",
        example: "Input: a = 5, b = 3\nOutput: 8",
        testCases: [
            { input: [1, 2], expectedOutput: 3 },
            { input: [5, 5], expectedOutput: 10 },
            { input: [-1, 1], expectedOutput: 0 },
            { input: [0, 0], expectedOutput: 0 },
            { input: [100, 200], expectedOutput: 300 },
        ],
        correctSolutionSnippet: "return a + b;",
    },
    {
        id: 'multiplyByTen',
        title: "Multiply by Ten",
        description: "Write a function that takes a number `x` and returns `x` multiplied by 10.",
        example: "Input: x = 7\nOutput: 70",
        testCases: [
            { input: [1], expectedOutput: 10 },
            { input: [0], expectedOutput: 0 },
            { input: [-5], expectedOutput: -50 },
            { input: [100], expectedOutput: 1000 },
        ],
        correctSolutionSnippet: "return x * 10;",
    },
    {
        id: 'isEven',
        title: "Is Even?",
        description: "Write a function that takes a number `n` and returns `true` if it's even, `false` otherwise.",
        example: "Input: n = 4\nOutput: true",
        testCases: [
            { input: [2], expectedOutput: true },
            { input: [3], expectedOutput: false },
            { input: [0], expectedOutput: true },
            { input: [100], expectedOutput: true },
            { input: [99], expectedOutput: false },
        ],
        correctSolutionSnippet: "return n % 2 === 0;",
    }
];


const Arena = ({
    socket,
    currentRoomId,
    playersInRoom,
    gameStatus,
    currentProblemId,
    winnerId,
    setMessage,
    showCustomModal,
    resetGame
}) => {
    // Find the full problem object based on problemId
    const currentProblem = PROBLEMS.find(p => p.id === currentProblemId);

    // Refs for code editors to prevent re-rendering issues with textarea value
    const playerCodeRefs = useRef({});

    // Effect to update editor content when playersInRoom changes (e.g., opponent types)
    useEffect(() => {
        playersInRoom.forEach(player => {
            if (playerCodeRefs.current[player.id]) {
                // Only update if the code in the ref is different from the player's code in state
                // This prevents overwriting user's typing if they are the current player
                if (playerCodeRefs.current[player.id].value !== player.code) {
                    playerCodeRefs.current[player.id].value = player.code;
                }
            }
        });
    }, [playersInRoom]); // Re-run when playersInRoom array changes

    // Simulate running test cases on the client
    const runTests = () => {
        if (!socket || !currentRoomId || !currentProblem || gameStatus !== 'in-progress') {
            showCustomModal("Game is not in progress or problem not loaded.");
            return;
        }

        setMessage('Running tests...');
        let passedCount = 0;
        const code = playerCodeRefs.current[socket.id]?.value || ''; // Get code from ref

        // Simple simulation: check if the correct solution snippet is present in the code
        const isCorrectSolutionPresent = code.includes(currentProblem.correctSolutionSnippet);

        if (isCorrectSolutionPresent) {
            passedCount = currentProblem.testCases.length; // Simulate passing all tests
        } else {
            // Simulate partial success if the code is not completely correct but has some logic
            if (code.includes("function") && code.includes("return")) {
                passedCount = Math.floor(currentProblem.testCases.length / 2); // Pass half if function structure exists
            }
        }

        // Emit solution to server
        socket.emit('submitSolution', { roomId: currentRoomId, passedTests });
        setMessage(`Tests run. Passed: ${passedCount}/${currentProblem.testCases.length}`);
    };

    // Handle code changes in the editor
    const handleCodeChange = (e) => {
        const newCode = e.target.value;
        // Update local ref immediately
        if (playerCodeRefs.current[socket.id]) {
            playerCodeRefs.current[socket.id].value = newCode;
        }
        // Emit code change to server for opponent to see
        if (socket && currentRoomId && gameStatus === 'in-progress') {
            socket.emit('codeChange', { roomId: currentRoomId, code: newCode });
        }
    };

    // Determine current user and opponent for display purposes
    const myPlayer = playersInRoom.find(p => p.id === socket?.id);
    const opponentPlayer = playersInRoom.find(p => p.id !== socket?.id);

    return (
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-6xl flex flex-col lg:flex-row gap-8">
            {/* Problem Statement and Player Info */}
            <div className="flex-1 flex flex-col space-y-6">
                <h2 className="text-3xl font-bold text-purple-400 mb-4">Room: {currentRoomId}</h2>

                {(gameStatus === 'in-progress' || gameStatus === 'finished') && currentProblem && (
                    <div className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600">
                        <h3 className="text-2xl font-semibold text-pink-300 mb-3">{currentProblem.title}</h3>
                        <p className="text-gray-300 mb-4">{currentProblem.description}</p>
                        <pre className="bg-gray-800 text-gray-200 p-4 rounded-md text-sm overflow-auto border border-gray-600">
                            {currentProblem.example}
                        </pre>
                        <h4 className="text-xl font-semibold text-gray-300 mt-4 mb-2">Test Cases (Simulated):</h4>
                        <ul className="list-disc list-inside text-gray-400 text-sm">
                            {currentProblem.testCases.map((tc, index) => (
                                <li key={index}>Input: [{tc.input.join(', ')}] Expected: {tc.expectedOutput}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Player Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playersInRoom.map((player) => {
                        const isCurrentPlayer = player.id === socket?.id;
                        const isWinner = winnerId === player.id;
                        const borderColor = isWinner ? 'border-yellow-400' : (isCurrentPlayer ? 'border-blue-500' : 'border-gray-600');
                        const bgColor = isCurrentPlayer ? 'bg-gray-700' : 'bg-gray-700';

                        return (
                            <div key={player.id} className={`${bgColor} p-4 rounded-lg shadow-md border-2 ${borderColor}`}>
                                <h4 className="text-xl font-semibold mb-2 flex items-center">
                                    <svg className="w-6 h-6 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                    {player.name}
                                    {isCurrentPlayer && <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">YOU</span>}
                                    {isWinner && <span className="ml-2 text-xs bg-yellow-500 px-2 py-1 rounded-full">WINNER!</span>}
                                </h4>
                                <p className="text-gray-300">
                                    Passed Tests: <span className="font-bold text-lg text-green-400">{player.passedTests}</span> / {currentProblem?.testCases.length || 0}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {gameStatus === 'finished' && (
                    <button
                        onClick={resetGame}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg mt-4"
                    >
                        Reset Game for New Round
                    </button>
                )}
            </div>

            {/* Code Editors and Controls */}
            {(gameStatus === 'in-progress' || gameStatus === 'finished') && currentProblem && (
                <div className="flex-1 flex flex-col space-y-6">
                    {/* My Code Editor */}
                    <h2 className="text-3xl font-bold text-yellow-400">{myPlayer?.name}'s Code</h2>
                    <textarea
                        ref={el => playerCodeRefs.current[socket?.id] = el}
                        defaultValue={myPlayer?.code || `function ${currentProblem.title.replace(/\s/g, '').toLowerCase()}(${currentProblem.testCases[0].input.map((_, i) => String.fromCharCode(97 + i)).join(', ')}) {\n  // Write your code here\n}`}
                        onChange={handleCodeChange}
                        placeholder={`function ${currentProblem.title.replace(/\s/g, '').toLowerCase()}(${currentProblem.testCases[0].input.map((_, i) => String.fromCharCode(97 + i)).join(', ')}) {\n  // Write your code here\n}`}
                        className="w-full h-72 p-4 rounded-lg bg-gray-900 border border-gray-600 text-gray-200 font-mono text-sm resize-y focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        spellCheck="false"
                        disabled={gameStatus === 'finished'}
                    ></textarea>
                    <button
                        onClick={runTests}
                        disabled={gameStatus === 'finished'}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-xl"
                    >
                        Run Tests
                    </button>

                    {/* Opponent's Code Editor */}
                    {opponentPlayer && (
                        <>
                            <h2 className="text-3xl font-bold text-green-400 mt-8">{opponentPlayer.name}'s Code</h2>
                            <textarea
                                ref={el => playerCodeRefs.current[opponentPlayer.id] = el}
                                defaultValue={opponentPlayer.code || `function ${currentProblem.title.replace(/\s/g, '').toLowerCase()}(${currentProblem.testCases[0].input.map((_, i) => String.fromCharCode(97 + i)).join(', ')}) {\n  // Opponent's code will appear here\n}`}
                                className="w-full h-72 p-4 rounded-lg bg-gray-900 border  text-gray-200 font-mono text-sm resize-y border-dashed border-gray-500"
                                spellCheck="false"
                                readOnly // Opponent's editor is read-only
                            ></textarea>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default Arena;