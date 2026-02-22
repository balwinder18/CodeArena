import React, { useRef, useEffect, useState } from 'react';
import Editor from "@monaco-editor/react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import axios from 'axios';



const LANGUAGES = [

    { id: 54, name: "C++", mode: "cpp" },
    { id: 62, name: "Java", mode: "java" },
];

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




const generateDefaultFunction = (problem, langMode) => {
    if (!problem || !problem.testCases || problem.testCases.length === 0) return '';

    switch (langMode) {
        case 'java': {
            return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        // TODO: Read input here
        // Example:
        // int n = sc.nextInt();
        // int[] arr = new int[n];
        // for (int i = 0; i < n; i++) arr[i] = sc.nextInt();
        
        // TODO: Write your solution logic here
        
        // TODO: Print the output
        // System.out.println(answer);
        
    }
}`;
        }
        case 'cpp': {
            return `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: Read input here
    // int n; cin >> n;
    // vector<int> arr(n);
    // for (int i = 0; i < n; i++) cin >> arr[i];
    
    // TODO: Write your solution logic here
    
    // TODO: Print output
    // cout << answer << "\\n";

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
    currentProblem,
    winnerId,
    setMessage,
    showCustomModal,
    leaveRoom,
    giveUp
}) => {


    const editorInstanceRef = useRef(null);
    const [codeValue, setCodeValue] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
    const [activeBottomTab, setActiveBottomTab] = useState('testcase');
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (currentProblem) {
            const newCode = generateDefaultFunction(currentProblem, selectedLanguage.mode);
            setCodeValue(newCode);
        }
    }, [currentProblem, selectedLanguage]);

    useEffect(() => {
        const myPlayer = playersInRoom.find(p => p.id === socket?.id);
        if (myPlayer && myPlayer.code && myPlayer.code !== codeValue) {

        }
    }, [playersInRoom, socket?.id, codeValue]);


    const handleEditorDidMount = (editor, monaco) => {
        editorInstanceRef.current = editor;
    };

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

    const handleLanguageChange = (e) => {
        const langId = parseInt(e.target.value, 10);
        const lang = LANGUAGES.find(l => l.id === langId);
        if (lang) {
            setSelectedLanguage(lang);
        }
    };

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
            if (socket && currentRoomId) {
                    socket.emit('submitSolution', { roomId: currentRoomId, passedTests: passedCount });
                }

                if (passedCount === totalCount && socket && currentRoomId) {
                    socket.emit('gameWon', { roomId: currentRoomId });
                }

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
                const errorMessage = `Error submitting solution: ${result.error || 'Unknown server error'}`;
                setOutput(errorMessage);
                showCustomModal(errorMessage);
            }

        } catch (err) {
            const networkError = `Network error: ${err.message}`;
            setOutput(networkError);
            showCustomModal('Could not connect to the submission service.');
        } finally {
            setIsRunning(false);
        }
    };


    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] w-full bg-gray-900 text-gray-300 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center bg-gray-900 p-3 border-b border-gray-700">
                <span className="text-lg font-semibold text-gray-200">Coding Arena</span>
                <div className='flex flex-row gap-2'>
                    <div className="flex justify-end items-center space-x-3">
                        {gameStatus === 'finished' ? (
                            <button
                                onClick={leaveRoom}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-transform transform hover:scale-105 shadow-lg"
                            >
                                Leave Room
                            </button>
                        ) : (
                            <>

                            <button
                                    onClick={giveUp}
                                    disabled={isRunning || gameStatus !== 'in-progress'}
                                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Give Up.
                                </button>
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
            </div>

            <PanelGroup direction="horizontal" className="flex-1">
                <Panel defaultSize={40} minSize={25} className="flex flex-col p-6 border-r border-gray-700 overflow-y-auto bg-gray-900">
                    {currentProblem ? (
                        <> 
                         <div className="flex-1 overflow-y-auto">
                            <div className="flex border-b border-gray-700 mb-4">
                                <button className="px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400">
                                    Description
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-gray-100 mb-2">{currentProblem.title}</h3>

                            <div className="flex items-center space-x-2 text-sm mb-4">
                                <span className="px-2 py-1 rounded-full bg-green-600 text-white">
                                    {currentProblem.difficulty}
                                </span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-500">Room: {currentRoomId}</span>
                            </div>

                            {/* Problem Statement */}
                            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                {currentProblem.description}
                            </p>

                            {/* Input Format */}
                            <h4 className="text-lg font-semibold text-gray-200 mt-4 mb-2">
                                Input Format:
                            </h4>
                            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                {currentProblem.inputFormat}
                            </p>

                            {/* Output Format */}
                            <h4 className="text-lg font-semibold text-gray-200 mt-4 mb-2">
                                Output Format:
                            </h4>
                            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                {currentProblem.outputFormat}
                            </p>

                            {/* Example */}
                            <h4 className="text-lg font-semibold text-gray-200 mt-4 mb-2">
                                Example:
                            </h4>
                            <pre className="bg-gray-900 text-gray-200 p-4 rounded-md text-sm overflow-auto border border-gray-600">
                                {currentProblem.example}
                            </pre>
                            </div>

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

                <Panel defaultSize={60} minSize={30} className="flex flex-col bg-gray-900">
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

                        <Panel defaultSize={30} minSize={20} className="flex flex-col p-4 bg-gray-900 border-t border-gray-700">
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
                                    <pre>
                                        Input: {currentProblem ? currentProblem.testCases[0].input : 'N/A'}
                                    </pre>
                                )}
                                {activeBottomTab === 'result' && (
                                    <pre className="whitespace-pre-wrap">{output || 'Run or submit your code to see the result.'}</pre>
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