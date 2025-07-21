'use client';



import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import GameRoom from './GameRoom';
import Arena from './Arena';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;

export default function HomePage() {


 const [socket, setSocket] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState(''); 
    const [currentRoomId, setCurrentRoomId] = useState(null); 
    const [message, setMessage] = useState(''); 
    const [playersInRoom, setPlayersInRoom] = useState([]);
    const [showModal, setShowModal] = useState(false); 
    const [modalContent, setModalContent] = useState(''); 
    const [setupStep, setSetupStep] = useState('landing');

   

    const [gameStatus, setGameStatus] = useState('waiting'); // 'waiting', 'in-progress', 'finished'
    const [currentProblemId, setCurrentProblemId] = useState(null);
    const [winnerId, setWinnerId] = useState(null); // Socket ID of the winner, or 'draw'

    
    const showCustomModal = (content) => {
        setModalContent(content);
        setShowModal(true);
    };

    const closeCustomModal = () => {
        setShowModal(false);
        setModalContent('');
    };

    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server:', newSocket.id);
            setMessage('Connected to server. Choose to create or join a room!');
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO server');
            setMessage('Disconnected from server. Please refresh.');
            setCurrentRoomId(null);
            setPlayersInRoom([]);
            setSetupStep('landing');
            setGameStatus('waiting');
            setCurrentProblemId(null);
            setWinnerId(null);
        });

        newSocket.on('roomCreated', (data) => {
            console.log('Room created:', data);
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Room created! Share this ID: ${data.roomId}`);
            setSetupStep('inRoom'); 
            setGameStatus('waiting'); 
        });

        newSocket.on('roomJoined', (data) => {
            console.log('Room joined:', data);
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Joined room: ${data.roomId}`);
            setSetupStep('inRoom'); 
          
            if (data.gameStatus) {
                setGameStatus(data.gameStatus);
                setCurrentProblemId(data.problemId);
                setWinnerId(data.winnerId);
            } else {
                setGameStatus('waiting');
            }
        });

        newSocket.on('roomError', (errorMessage) => {
            console.error('Room error:', errorMessage);
            showCustomModal(`Error: ${errorMessage}`);
            setMessage(`Error: ${errorMessage}`);
            setSetupStep('landing'); 
        });

        newSocket.on('playerJoinedRoom', (data) => {
            console.log('Player joined room update:', data);
            setPlayersInRoom(data.players);
            setMessage(`${data.playerName} joined the room!`);
        });

        newSocket.on('playerLeftRoom', (data) => {
            console.log('Player left room update:', data);
            setPlayersInRoom(data.players);
            setMessage(`${data.playerName} left the room.`);
            if (data.gameStatus === 'finished' && data.winnerId) {
                const winnerName = data.players.find(p => p.id === data.winnerId)?.name || 'Opponent';
                showCustomModal(`${data.playerName} left. ${winnerName} wins by default!`);
                setGameStatus('finished');
                setWinnerId(data.winnerId);
            } else if (data.players.length < 2) {
                setGameStatus('waiting');
                setCurrentProblemId(null);
                setWinnerId(null);
                setMessage('Waiting for another player...');
            }
        });

        newSocket.on('gameStarted', (data) => {
            console.log('Game started:', data);
            setGameStatus('in-progress');
            setCurrentProblemId(data.problemId);
            setWinnerId(null);
            
            setPlayersInRoom(prevPlayers => prevPlayers.map(p => ({ ...p, code: '', passedTests: 0 })));
            setMessage('Game started! Good luck!');
        });

        // newSocket.on('codeUpdate', (data) => {
        //     setPlayersInRoom(prevPlayers =>
        //         prevPlayers.map(p =>
        //             p.id === data.playerId ? { ...p, code: data.code } : p
        //         )
        //     );
        // });

        newSocket.on('testResultsUpdate', (data) => {
            setPlayersInRoom(prevPlayers =>
                prevPlayers.map(p =>
                    p.id === data.playerId ? { ...p, passedTests: data.passedTests } : p
                )
            );
            setMessage(`Player ${playersInRoom.find(p => p.id === data.playerId)?.name || 'Unknown'} passed ${data.passedTests} tests.`);
        });

        newSocket.on('gameFinished', (data) => {
            setGameStatus('finished');
            setWinnerId(data.winnerId);
            const winnerName = data.winnerId === 'draw' ? 'It\'s a draw!' :
                               playersInRoom.find(p => p.id === data.winnerId)?.name || 'Unknown Player';
            showCustomModal(`Game Over! Winner: ${winnerName}`);
            setMessage(`Game finished! Winner: ${winnerName}`);
        });

        newSocket.on('gameReset', () => {
            setGameStatus('waiting');
            setCurrentProblemId(null);
            setWinnerId(null);
            setPlayersInRoom(prevPlayers => prevPlayers.map(p => ({ ...p, code: '', passedTests: 0 })));
            setMessage('Game has been reset. Waiting for players to start a new round.');
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

   
    const handleCreateMatchClick = () => {
        setSetupStep('createName');
        setMessage('');
    };

    const handleJoinMatchClick = () => {
        setSetupStep('joinName');
        setMessage('');
    };

    
    const confirmCreateRoom = () => {
        if (!socket || !playerName) {
            showCustomModal("Please enter your name and ensure you are connected to the server.");
            return;
        }
        setMessage('Creating room...');
        socket.emit('createRoom', { playerName });
    };

    
    const confirmJoinRoom = () => {
        if (!socket || !playerName || !roomIdInput) {
            showCustomModal("Please enter your name and a Room ID, and ensure you are connected to the server.");
            return;
        }
        setMessage(`Joining room ${roomIdInput}...`);
        socket.emit('joinRoom', { roomId: roomIdInput, playerName });
    };

    
    const startGame = () => {
        if (!socket || !currentRoomId || playersInRoom.length < 2) {
            showCustomModal("Cannot start game. Ensure two players are in the room.");
            return;
        }
        if (gameStatus === 'in-progress') {
            showCustomModal("Game is already in progress.");
            return;
        }
        setMessage('Starting game...');
        socket.emit('startGame', { roomId: currentRoomId });
    };

    const resetGame = () => {
        if (!socket || !currentRoomId) return;
        socket.emit('resetGame', { roomId: currentRoomId });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 text-white font-inter p-4 flex flex-col items-center">
            
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-600 max-w-sm w-full text-center">
                        <p className="text-xl font-semibold mb-6">{modalContent}</p>
                        <button
                            onClick={closeCustomModal}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <h1 className="text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
                Code Arena
            </h1>

            {/* Message Area */}
            {/* {message && (
                <div className="bg-blue-900 text-blue-200 p-3 rounded-lg mb-6 max-w-2xl text-center shadow-md">
                    {message}
                </div>
            )} */}

            {/* Conditional Rendering based on setupStep and currentRoomId */}
            {!currentRoomId ? (
                <>
                    {setupStep === 'landing' && (
                        <div className="text-center max-w-3xl">
                            <span className="text-sm px-3 py-1 border border-yellow-500 rounded-full text-yellow-400 mb-4 inline-block">
                                ⚔️ Proudly Real-Time
                            </span>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
                                Compete in Code. <br />
                                Win in Real-Time.
                            </h1>
                            <p className="text-lg text-gray-400 mb-8">
                                Battle your friends live with DSA problems. First to solve wins. No BS, just speed and skill.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                                <button
                                    onClick={handleCreateMatchClick}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:scale-105 transition shadow-lg"
                                >
                                    Create Room
                                </button>

                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Enter Room Code"
                                        value={roomIdInput}
                                        onChange={(e) => setRoomIdInput(e.target.value)}
                                        className="bg-gray-800 border border-gray-600 px-4 py-2 rounded-md text-white placeholder-gray-500"
                                    />
                                    <button
                                        onClick={handleJoinMatchClick}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Share room code to challenge a friend. No login needed.
                            </p>
                        </div>
                    )}

                    {setupStep === 'createName' && (
                        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col items-center space-y-6">
                            <h2 className="text-3xl font-bold text-green-400">Enter Your Name</h2>
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={confirmCreateRoom}
                                disabled={!socket || !playerName}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Room
                            </button>
                            <button
                                onClick={() => setSetupStep('landing')}
                                className="text-gray-400 hover:text-gray-300 transition duration-200"
                            >
                                Back
                            </button>
                        </div>
                    )}

                    {setupStep === 'joinName' && (
                        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col items-center space-y-6">
                            <h2 className="text-3xl font-bold text-blue-400">Join Room</h2>
                            <input
                                type="text"
                                placeholder="Enter Room ID"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={confirmJoinRoom}
                                disabled={!socket || !playerName || !roomIdInput}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Join Room
                            </button>
                            <button
                                onClick={() => setSetupStep('landing')}
                                className="text-gray-400 hover:text-gray-300 transition duration-200"
                            >
                                Back
                            </button>
                        </div>
                    )}
                </>
            ) : (
                gameStatus === 'waiting' ? (
                    <GameRoom
                        socket={socket}
                        playerName={playerName}
                        currentRoomId={currentRoomId}
                        playersInRoom={playersInRoom}
                        gameStatus={gameStatus}
                        startGame={startGame} 
                    />
                ) : (
                    <Arena
                        socket={socket}
                        currentRoomId={currentRoomId}
                        playersInRoom={playersInRoom}
                        gameStatus={gameStatus}
                        currentProblemId={currentProblemId}
                        winnerId={winnerId}
                        setMessage={setMessage}
                        showCustomModal={showCustomModal}
                        resetGame={resetGame}
                    />
                )

                
            )}
           {gameStatus == "waiting" ? (
             <div className="mt-16 w-full max-w-5xl">
                <h2 className="text-xl font-semibold text-white mb-4">Why Coding Arena?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                        <h3 className="text-lg font-bold mb-2">Real-Time Battles</h3>
                        <p className="text-sm text-gray-400">Live problem-solving. Compete instantly.</p>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                        <h3 className="text-lg font-bold mb-2">Fair Play</h3>
                        <p className="text-sm text-gray-400">Both users get same questions, own editors.</p>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                        <h3 className="text-lg font-bold mb-2">Aura Farming</h3>
                        <p className="text-sm text-gray-400">Increase Your Aura.</p>
                    </div>
                </div>
            </div>
           ) : (<></>)}
        </div>


  );
}
