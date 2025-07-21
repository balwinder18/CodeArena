import React, { useRef, useEffect, useState } from 'react';
import Editor from "@monaco-editor/react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

// This component simulates a competitive coding arena.
// NOTE: The backend API for code execution (`/api/execute`) and the WebSocket server
// are assumed to be implemented elsewhere. This component is the front-end portion.

// Problem definitions are kept on the client for easy access to display
// information and for referencing test cases.
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
    }
];

// Configuration for supported languages, including their Judge0 API ID and Monaco editor mode.
const LANGUAGES = [
   
    { id: 54, name: "C++", mode: "cpp" },
    { id: 62, name: "Java", mode: "java" },
];

// Helper function to call the backend API for a single code execution.
const runCodeAPI = async (code, languageId, input) => {
    try {
        const res = await fetch("/api/execute", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_code: code,
                language_id: languageId,
                stdin: Array.isArray(input) ? input.join('\n') : String(input),
            }),
        });
        return await res.json();
    } catch (err) {
        console.error("API Error:", err);
        return { stderr: "Failed to connect to the execution service." };
    }
};


// Generates a default function template based on the problem and selected language.
const generateDefaultFunction = (problem, langMode) => {
    if (!problem) return '';
    const functionName = problem.title.replace(/\s+/g, '');
    const paramInputs = problem.testCases[0].input;

    switch (langMode) {
        case 'java': {
            const javaParamTypes = paramInputs.map(() => `int`); // Assuming int for simplicity
            const javaParams = javaParamTypes.map((type, i) => `${type} arg${i}`).join(', ');
            const scannerLines = javaParamTypes.map((_, i) => `int arg${i} = sc.nextInt();`).join('\n        ');
            const functionCallParams = javaParamTypes.map((_, i) => `arg${i}`).join(', ');

            return `import java.util.*;

// Do not change the class name
public class Main {
    
    /**
     * This is the method you need to implement.
     */
    public int ${functionName}(${javaParams}) {
        // Write your solution logic here
        return 0; 
    }

    // --- Boilerplate - Do not edit below this line ---
    public static void main(String[] args) {
        Main solution = new Main();
        Scanner sc = new Scanner(System.in);
        
        ${scannerLines}
        
        System.out.println(solution.${functionName}(${functionCallParams}));
        
        sc.close();
    }
}`;
        }
        case 'cpp': {
            const cppParamTypes = paramInputs.map(() => `int`);
            const cppParams = cppParamTypes.map((type, i) => `${type} arg${i}`).join(', ');
            const cinLines = cppParamTypes.map((_, i) => `    int arg${i};\n    std::cin >> arg${i};`).join('\n');
            const cppCallParams = cppParamTypes.map((_, i) => `arg${i}`).join(', ');

            return `#include <iostream>

class Solution {
public:
    /**
     * This is the method you need to implement.
     */
    int ${functionName}(${cppParams}) {
        // Write your solution logic here
        return 0;
    }
};

// --- Boilerplate - Do not edit below this line ---
int main() {
    Solution solution;
${cinLines}
    
    int result = solution.${functionName}(${cppCallParams});
    std::cout << result << std::endl;
    
    return 0;
}`;
        }
        default:
            return `// Please select a language.`;
    }
};


const Arena = ({
    socket,
    currentRoomId,
    playersInRoom,
    gameStatus,
    currentProblemId,
    winnerId,
    setMessage,
    showCustomModal,
     leaveRoom 
}) => {
    // Find the current problem from the hardcoded list.
    const currentProblem = PROBLEMS.find(p => p.id === currentProblemId);

    // Refs and State
    const editorInstanceRef = useRef(null);
    const [codeValue, setCodeValue] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]); // Default to JavaScript
    const [activeBottomTab, setActiveBottomTab] = useState('testcase'); // 'testcase' or 'result'
    const [output, setOutput] = useState(''); // For displaying results from run/submit
    const [isRunning, setIsRunning] = useState(false);

    // Effect to set initial code when the problem or language changes.
    useEffect(() => {
        if (currentProblem) {
            const newCode = generateDefaultFunction(currentProblem, selectedLanguage.mode);
            setCodeValue(newCode);
        }
    }, [currentProblem, selectedLanguage]);

    // Effect to listen for code updates from other players via WebSocket.
    useEffect(() => {
        const myPlayer = playersInRoom.find(p => p.id === socket?.id);
        if (myPlayer && myPlayer.code && myPlayer.code !== codeValue) {
            // setCodeValue(myPlayer.code);
        }
    }, [playersInRoom, socket?.id, codeValue]);


    const handleEditorDidMount = (editor, monaco) => {
        editorInstanceRef.current = editor;
    };

    // Handles code changes in the editor.
    const handleEditorChange = (value) => {
        const newCode = value || '';
        setCodeValue(newCode);
        if (socket && currentRoomId) {
            socket.emit('codeChange', {
                roomId: currentRoomId,
                code: newCode,
            });
        }
    };
    
    // Handles language selection from the dropdown.
    const handleLanguageChange = (e) => {
        const langId = parseInt(e.target.value, 10);
        const lang = LANGUAGES.find(l => l.id === langId);
        if (lang) {
            setSelectedLanguage(lang);
        }
    };

    // Runs the code against the first test case for quick feedback.
    const handleRunCode = async () => {
        if (!currentProblem || isRunning) return;

        setIsRunning(true);
        setOutput('Running your code...');
        setActiveBottomTab('result');

        const firstTestCase = currentProblem.testCases[0];
        const result = await runCodeAPI(codeValue, selectedLanguage.id, firstTestCase.input);

        let resultText = `Input:\n${JSON.stringify(firstTestCase.input)}\n\n`;
        if (result.stderr) {
            resultText += `Error:\n${result.stderr}`;
        } else if (result.compile_output) {
            resultText += `Compile Error:\n${result.compile_output}`;
        } else {
            resultText += `Your Output:\n${result.stdout || ''}`;
        }
        resultText += `\n\nExpected Output:\n${firstTestCase.expectedOutput}`;

        setOutput(resultText);
        setIsRunning(false);
    };

    // Submits the solution for grading by the backend and emits results to the server.
    const handleSubmitSolution = async () => {
        if (!currentProblem || isRunning || gameStatus !== 'in-progress') {
            showCustomModal("Cannot submit right now. The game may not be in progress.");
            return;
        }
    
        setIsRunning(true);
        setOutput('Submitting and running all test cases...');
        setMessage('Submitting solution...');
        setActiveBottomTab('result');
    
        try {
            // This new API endpoint will handle running all test cases.
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_code: codeValue,
                    language_id: selectedLanguage.id,
                    testCases: currentProblem.testCases,
                }),
            });
    
            const result = await response.json();
    
            if (response.ok) {
                const { passedCount, totalCount } = result;
    
                // Emit the score update to the server so all players see the new score.
                if(socket && currentRoomId) {
                    socket.emit('submitSolution', { roomId: currentRoomId, passedTests: passedCount });
                }
    
                // If all tests passed, emit a separate event to declare the winner.
                if (passedCount === totalCount && socket && currentRoomId) {
                    socket.emit('gameWon', { roomId: currentRoomId });
                }

                // Update local UI with the result from the backend.
                let submissionResult;
                if (passedCount === totalCount) {
                    submissionResult = `Congratulations! All ${totalCount} tests passed!`;
                    setMessage("Solution submitted and all tests passed!");
                } else {
                    submissionResult = `Submission Result: Passed ${passedCount} out of ${totalCount} tests.\nKeep trying!`;
                    setMessage(`Solution submitted. Passed: ${passedCount}/${totalCount}`);
                }
                setOutput(submissionResult);

            } else {
                // Handle errors returned from our own backend.
                const errorMessage = `Error submitting solution: ${result.error || 'Unknown server error'}`;
                setOutput(errorMessage);
                showCustomModal(errorMessage);
            }
    
        } catch (err) {
            // Handle network errors (e.g., backend is down).
            const networkError = `Network error: ${err.message}`;
            setOutput(networkError);
            showCustomModal('Could not connect to the submission service.');
        } finally {
            setIsRunning(false);
        }
    };


    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] w-full bg-gray-900 text-gray-300 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
            {/* Top Bar within Arena */}
            <div className="flex justify-between items-center bg-gray-800 p-3 border-b border-gray-700">
                <span className="text-lg font-semibold text-gray-200">Coding Arena</span>
                <div className="flex items-center space-x-4">
                     <select
                        value={selectedLanguage.id}
                        onChange={handleLanguageChange}
                        disabled={isRunning || gameStatus === 'finished'}
                        className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-60"
                    >
                        {LANGUAGES.map((lang) => (
                            <option key={lang.id} value={lang.id}>
                                {lang.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area: Resizable Panels */}
            <PanelGroup direction="horizontal" className="flex-1">
                {/* Left Panel: Problem Description */}
                <Panel defaultSize={40} minSize={25} className="flex flex-col p-6 border-r border-gray-700 overflow-y-auto bg-gray-800">
                    {currentProblem ? (
                        <>
                            <div className="flex border-b border-gray-700 mb-4">
                                <button className="px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400">Description</button>
                            </div>
                            <h3 className="text-xl font-bold text-gray-100 mb-2">{currentProblem.title}</h3>
                            <div className="flex items-center space-x-2 text-sm mb-4">
                                <span className="px-2 py-1 rounded-full bg-green-600 text-white">Easy</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-500">Room: {currentRoomId}</span>
                            </div>
                            <p className="text-gray-300 text-sm mb-4 leading-relaxed">{currentProblem.description}</p>
                            <h4 className="text-lg font-semibold text-gray-200 mt-4 mb-2">Example:</h4>
                            <pre className="bg-gray-900 text-gray-200 p-4 rounded-md text-sm overflow-auto border border-gray-600">
                                {currentProblem.example}
                            </pre>
                             {/* Player Status below problem for score comparison */}
                             <div className="mt-auto pt-4 border-t border-gray-700">
                                 <h4 className="text-lg font-semibold text-gray-200 mb-2">Live Scores:</h4>
                                 <div className="grid grid-cols-1 gap-2">
                                     {playersInRoom.map((player) => {
                                         const isCurrentPlayer = player.id === socket?.id;
                                         const isWinner = winnerId === player.id;
                                         const statusColor = isWinner ? 'text-yellow-400' : (isCurrentPlayer ? 'text-blue-400' : 'text-gray-400');

                                         return (
                                             <div key={player.id} className="flex items-center justify-between text-sm p-2 bg-gray-900 rounded-md">
                                                 <span className={`${statusColor} font-medium flex items-center`}>
                                                     <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                                     {player.name} {isCurrentPlayer && "(You)"}
                                                 </span>
                                                 <div className="flex items-center">
                                                    <span className="text-green-400 font-bold">
                                                        {player.passedTests} / {currentProblem.testCases.length}
                                                    </span>
                                                    {isWinner && <span className="ml-3 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">WINNER!</span>}
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-400">Waiting for the game to start...</div>
                    )}
                </Panel>

                <PanelResizeHandle className="w-2 bg-gray-700 hover:bg-blue-500 transition-colors cursor-ew-resize flex items-center justify-center">
                    <div className="w-1 h-8 bg-gray-500 rounded-full"></div>
                </PanelResizeHandle>

                {/* Right Panel: Code Editor and Controls */}
                <Panel defaultSize={60} minSize={30} className="flex flex-col bg-gray-800">
                    <PanelGroup direction="vertical" className="flex-1">
                        <Panel defaultSize={70} minSize={50}>
                            <Editor
                                height="100%"
                                language={selectedLanguage.mode}
                                theme="vs-dark"
                                value={codeValue}
                                onMount={handleEditorDidMount}
                                onChange={handleEditorChange}
                                options={{
                                    fontSize: 14,
                                    minimap: { enabled: false },
                                    wordWrap: 'on',
                                    scrollBeyondLastLine: false,
                                    readOnly: gameStatus === 'finished' || isRunning,
                                }}
                            />
                        </Panel>

                        <PanelResizeHandle className="h-2 bg-gray-700 hover:bg-blue-500 transition-colors cursor-ns-resize flex items-center justify-center">
                            <div className="w-8 h-1 bg-gray-500 rounded-full"></div>
                        </PanelResizeHandle>

                        <Panel defaultSize={30} minSize={20} className="flex flex-col p-4 bg-gray-800 border-t border-gray-700">
                            <div className="flex border-b border-gray-700 mb-3">
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${activeBottomTab === 'testcase' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'} transition-colors`}
                                    onClick={() => setActiveBottomTab('testcase')}
                                >
                                    Testcase
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${activeBottomTab === 'result' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'} transition-colors`}
                                    onClick={() => setActiveBottomTab('result')}
                                >
                                    Result
                                </button>
                            </div>
                            <div className="bg-gray-900 p-3 rounded-md text-sm text-gray-300 flex-1 overflow-y-auto border border-gray-700">
                                {activeBottomTab === 'testcase' && (
                                    <pre>Input: {currentProblem ? JSON.stringify(currentProblem.testCases[0].input, null, 2) : 'N/A'}</pre>
                                )}
                                {activeBottomTab === 'result' && (
                                    <pre className="whitespace-pre-wrap">{output || 'Run or submit your code to see the result.'}</pre>
                                )}
                            </div>
                            <div className="flex justify-end items-center mt-4 space-x-3">
                                 {gameStatus === 'finished' ? (
                                <button
                                    onClick={leaveRoom} // KEY CHANGE: Call the leaveRoom prop
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-transform transform hover:scale-105 shadow-lg"
                                >
                                    Leave Room {/* KEY CHANGE: Updated button text */}
                                </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleRunCode}
                                            disabled={isRunning || gameStatus !== 'in-progress'}
                                            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isRunning ? 'Running...' : 'Run Code'}
                                        </button>
                                        <button
                                            onClick={handleSubmitSolution}
                                            disabled={isRunning || gameStatus !== 'in-progress'}
                                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-transform transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isRunning ? 'Submitting...' : 'Submit'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );
};

export default Arena;