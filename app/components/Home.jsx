'use client';

import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';


const SOCKET_SERVER_URL = 'http://localhost:3001';

export default function HomePage() {
  // const router = useRouter();
  // const [roomCode, setRoomCode] = useState('');

  // const createMatch = async () => {
  //   const res = await fetch('/api/match/create', { method: 'POST' });
  //   const data = await res.json();
  //   router.push(`/arena/${data.roomId}`);
  // };

  // const joinMatch = () => {
  //   if (roomCode.trim()) {
  //     router.push(`/arena/${roomCode}`);
  //   }
  // };

  // return (
  //   <main className="min-h-screen bg-black text-white px-6 py-12 flex flex-col items-center">
  //     <div className="text-center max-w-3xl">
  //       <span className="text-sm px-3 py-1 border border-yellow-500 rounded-full text-yellow-400 mb-4 inline-block">
  //         ⚔️ Proudly Real-Time
  //       </span>
  //       <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
  //         Compete in Code. <br />
  //         Win in Real-Time.
  //       </h1>
  //       <p className="text-lg text-gray-400 mb-8">
  //         Battle your friends live with DSA problems. First to solve wins. No BS, just speed and skill.
  //       </p>

  //       <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
  //         <button
  //           onClick={createMatch}
  //           className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:scale-105 transition shadow-lg"
  //         >
  //            Create Match
  //         </button>

  //         <div className="flex gap-2 items-center">
  //           <input
  //             type="text"
  //             placeholder="Enter Room Code"
  //             value={roomCode}
  //             onChange={(e) => setRoomCode(e.target.value)}
  //             className="bg-gray-800 border border-gray-600 px-4 py-2 rounded-md text-white placeholder-gray-500"
  //           />
  //           <button
  //             onClick={joinMatch}
  //             className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
  //           >
  //             Join
  //           </button>
  //         </div>
  //       </div>

  //       <p className="text-sm text-gray-500">
  //         Share room code to challenge a friend. No login needed.
  //       </p>
  //     </div>

  //     <div className="mt-16 w-full max-w-5xl">
  //       <h2 className="text-xl font-semibold text-white mb-4">🔥 Why Coding Arena?</h2>
  //       <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
  //         <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
  //           <h3 className="text-lg font-bold mb-2">Real-Time Battles</h3>
  //           <p className="text-sm text-gray-400">Live problem-solving. Compete instantly.</p>
  //         </div>
  //         <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
  //           <h3 className="text-lg font-bold mb-2">Fair Play</h3>
  //           <p className="text-sm text-gray-400">Both users get same questions, own editors.</p>
  //         </div>
  //         <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
  //           <h3 className="text-lg font-bold mb-2">Leaderboard</h3>
  //           <p className="text-sm text-gray-400">Climb rankings as you win more matches.</p>
  //         </div>
  //       </div>
  //     </div>
  //   </main>

 const [socket, setSocket] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState(''); // For joining existing room
    const [currentRoomId, setCurrentRoomId] = useState(null); // The room user is currently in
    const [message, setMessage] = useState(''); // General messages to the user
    const [playersInRoom, setPlayersInRoom] = useState([]); // List of players in the current room
    const [showModal, setShowModal] = useState(false); // For custom modal
    const [modalContent, setModalContent] = useState(''); // Content for the modal
    const [setupStep, setSetupStep] = useState('landing'); // 'landing', 'createName', 'joinName'

    // Function to show a custom modal
    const showCustomModal = (content) => {
        setModalContent(content);
        setShowModal(true);
    };

    // Function to close the custom modal
    const closeCustomModal = () => {
        setShowModal(false);
        setModalContent('');
    };

    // Initialize Socket.IO connection
    useEffect(() => {
        // Connect to the Socket.IO server
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        // Event listeners for Socket.IO
        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server:', newSocket.id);
            setMessage('Connected to server. Choose to create or join a room!');
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO server');
            setMessage('Disconnected from server. Please refresh.');
            setCurrentRoomId(null); // Reset room state on disconnect
            setPlayersInRoom([]);
            setSetupStep('landing'); // Go back to landing on disconnect
        });

        newSocket.on('roomCreated', (data) => {
            console.log('Room created:', data);
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Room created! Share this ID: ${data.roomId}`);
        });

        newSocket.on('roomJoined', (data) => {
            console.log('Room joined:', data);
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Joined room: ${data.roomId}`);
        });

        newSocket.on('roomError', (errorMessage) => {
            console.error('Room error:', errorMessage);
            showCustomModal(`Error: ${errorMessage}`);
            setMessage(`Error: ${errorMessage}`);
            // If there's an error joining/creating, go back to landing or re-enable inputs
            setSetupStep('landing'); // Or keep the current step if they can retry easily
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
        });


        // Clean up on component unmount
        return () => {
            newSocket.disconnect();
        };
    }, []); // Empty dependency array means this runs once on mount

    // Handlers for initial button clicks
    const handleCreateMatchClick = () => {
        setSetupStep('createName');
        setMessage(''); // Clear previous messages
    };

    const handleJoinMatchClick = () => {
        setSetupStep('joinName');
        setMessage(''); // Clear previous messages
    };

    // Function to confirm room creation after name input
    const confirmCreateRoom = () => {
        if (!socket || !playerName) {
            showCustomModal("Please enter your name and ensure you are connected to the server.");
            return;
        }
        setMessage('Creating room...');
        socket.emit('createRoom', { playerName });
    };

    // Function to confirm joining room after name and ID input
    const confirmJoinRoom = () => {
        if (!socket || !playerName || !roomIdInput) {
            showCustomModal("Please enter your name and a Room ID, and ensure you are connected to the server.");
            return;
        }
        setMessage(`Joining room ${roomIdInput}...`);
        socket.emit('joinRoom', { roomId: roomIdInput, playerName });
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
                // Display when in a room
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col items-center space-y-6">
                    <h2 className="text-3xl font-bold text-purple-400">Room ID: <span className="font-mono text-pink-300">{currentRoomId}</span></h2>
                    <p className="text-gray-300 text-lg">Welcome, <span className="font-semibold text-yellow-300">{playerName}</span>!</p>

                    <div className="w-full">
                        <h3 className="text-xl font-semibold text-gray-300 mb-2">Players in this Room:</h3>
                        <ul className="list-disc list-inside text-gray-400">
                            {playersInRoom.map((player, index) => (
                                <li key={player.id} className="flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                    {player.name} {player.id === socket.id && <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">YOU</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-gray-400 text-sm mt-4">Waiting for more players to join or for the game to start...</p>
                </div>
            )}
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
        </div>


  );
}
