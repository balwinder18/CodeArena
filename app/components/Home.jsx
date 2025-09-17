'use client';

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import GameRoom from './GameRoom';
import Arena from './Arena';
import VideoTrial from './VideoTrial'

import { motion, AnimatePresence } from "framer-motion";

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';

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
    const [currentProblem, setCurrentProblem] = useState(null);
    const [winnerId, setWinnerId] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [countdown, setCountdown] = useState(60);
    const [count, setCount] = useState(5);
    const[matchstart , setMatchstart] = useState(false);
  

    const showCustomModal = (content) => {
        setModalContent(content);
        setShowModal(true);
    };

    const closeCustomModal = () => {
        setShowModal(false);
        setModalContent('');
    };



    useEffect(() => {
        if (connectionStatus === 'connecting') {
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [connectionStatus]);


    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);


    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            setConnectionStatus('connected');
            setMessage('Connected to server. Choose to create or join a room!');
        };
        const onDisconnect = () => {
            setConnectionStatus('disconnected');
            setMessage('Disconnected from server. Please refresh.');
            setCurrentRoomId(null);
            setPlayersInRoom([]);
            setSetupStep('landing');
            setGameStatus('waiting');
            setCurrentProblem(null)
            setWinnerId(null);
        };

        const onRoomCreated = (data) => {
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Room created! Share this ID: ${data.roomId}`);
            setSetupStep('inRoom');
            setGameStatus('waiting');
        };
        const onRoomJoined = (data) => {
            setCurrentRoomId(data.roomId);
            setPlayersInRoom(data.players);
            setMessage(`Joined room: ${data.roomId}`);
            setSetupStep('inRoom');
            setGameStatus(data.gameStatus || 'waiting');
            setCurrentProblem(data.problem);
            setWinnerId(data.winnerId);
        };
        const onRoomError = (errorMessage) => {
            showCustomModal(`Error: ${errorMessage}`);
            setMessage(`Error: ${errorMessage}`);
            setSetupStep('landing');
        };

        const onPlayerJoined = (data) => {
            setPlayersInRoom(data.players);
            setMessage(`${data.playerName} joined the room!`);
        };
        const onPlayerLeft = (data) => {
            setPlayersInRoom(data.players);
            setMessage(`${data.playerName} left the room.`);
            if (data.players.length < 2 && data.gameStatus === 'in-progress') {
                setGameStatus('waiting');
                setCurrentProblem(null);
                setWinnerId(null);
                showCustomModal(`${data.playerName} left. The game has been reset.`);
            }
        };
const onGameStarted = (data) => {
            const { problem } = data;
            
            setGameStatus('in-progress');
            setCurrentProblem(problem);
            setWinnerId(null);
            setPlayersInRoom(prevPlayers => prevPlayers.map(p => ({ ...p, code: '', passedTests: 0 })));
            setMessage('Game started! Good luck!');
        };

        const onTestResultsUpdate = (data) => {
            setPlayersInRoom(prevPlayers => {
                const updatedPlayers = prevPlayers.map(p =>
                    p.id === data.playerId ? { ...p, passedTests: data.passedTests } : p
                );
                const playerName = updatedPlayers.find(p => p.id === data.playerId)?.name || 'Opponent';
                setMessage(`${playerName} passed ${data.passedTests} tests.`);
                return updatedPlayers;
            });
        };

        const onGameFinished = (data) => {
            setGameStatus('finished');
            setWinnerId(data.winnerId);
            const winnerName = data.winnerId === 'draw'
                ? "It's a draw!"
                : playersInRoom.find(p => p.id === data.winnerId)?.name || 'Unknown Player';
            showCustomModal(`Game Over! Winner: ${winnerName}`);
            setMessage(`Game finished! Winner: ${winnerName}`);
        };

        const onGameReset = () => {
            setGameStatus('waiting');
            setCurrentProblem(null);
            setWinnerId(null);
            setPlayersInRoom(prevPlayers => prevPlayers.map(p => ({ ...p, code: '', passedTests: 0 })));
            setMessage('Game has been reset. Waiting for players to start a new round.');
        };

        const onPlayerGaveUp = ({ loser, winner }) => {
        if (loser === playerName) {
            setMessage(`You gave up. ${winner} wins.`);
             showCustomModal(`You gave up! Winner: ${winner}`);
        } else {
            setMessage(`${loser} gave up. You are the winner! 🎉`);
            setWinnerId(socket.id);
             showCustomModal(`Opponent gave up! Winner: ${winner}`);
        }
        setGameStatus('finished');
        
    };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('roomCreated', onRoomCreated);
        socket.on('roomJoined', onRoomJoined);
        socket.on('roomError', onRoomError);
        socket.on('playerJoinedRoom', onPlayerJoined);
        socket.on('playerLeftRoom', onPlayerLeft);
        socket.on('gameStarted', onGameStarted);
        socket.on('testResultsUpdate', onTestResultsUpdate);
        socket.on('gameFinished', onGameFinished);
        socket.on('gameReset', onGameReset);
        socket.on('playerGaveUp', onPlayerGaveUp);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('roomCreated', onRoomCreated);
            socket.off('roomJoined', onRoomJoined);
            socket.off('roomError', onRoomError);
            socket.off('playerJoinedRoom', onPlayerJoined);
            socket.off('playerLeftRoom', onPlayerLeft);
            socket.off('gameStarted', onGameStarted);
            socket.off('testResultsUpdate', onTestResultsUpdate);
            socket.off('gameFinished', onGameFinished);
            socket.off('gameReset', onGameReset);
            socket.off('playerGaveUp', onPlayerGaveUp);
        };
    }, [socket, playersInRoom]);

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
            showCustomModal("Please enter your name.");
            return;
        }
        setMessage('Creating room...');
        socket.emit('createRoom', { playerName });
    };

    const confirmJoinRoom = () => {
        if (!socket || !playerName || !roomIdInput) {
            showCustomModal("Please enter your name and a Room ID.");
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

    const leaveRoom = () => {
        if (!socket || !currentRoomId) return;
        socket.emit('leaveRoom', { roomId: currentRoomId });
        setCurrentRoomId(null);
        setPlayersInRoom([]);
        setSetupStep('landing');
        setGameStatus('waiting');
        setCurrentProblem(null);
        setWinnerId(null);
        setMessage('You have left the room.');
    };

   const giveUp = () => {
    if (!socket || !currentRoomId) return;

    socket.emit('giveUp', { roomId: currentRoomId });

    setMessage('You gave up. Waiting for result...');
};



//timer
     

  useEffect(() => {
     if (gameStatus !== 'in-progress') return;
    if (count === 0) {
     setMatchstart(true);
      return;
    }
    const timer = setTimeout(() => setCount((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, gameStatus]);


    return (
        <div className="min-h-screen bg-gradient-to-tr from-black via-gray-950 to-black text-white font-sans p-4 flex flex-col items-center">

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

           <h1 className="text-6xl font-extrabold mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-600 drop-shadow-[0_0_20px_rgba(139,92,246,0.8)]">
  Code Arena
</h1>


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
                           <p className="text-lg text-gray-300 mb-8 leading-relaxed">
  Battle your friends live with <span className="text-purple-400 font-semibold">DSA problems</span>. 
  First to solve wins.
</p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                                <button
                                    onClick={handleCreateMatchClick}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:scale-105 transition shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                                >
                                    Create Room
                                </button>

                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Enter Room Code"
                                        value={roomIdInput}
                                        onChange={(e) => setRoomIdInput(e.target.value)}
                                        className="bg-gray-900 border border-purple-500/40 px-4 py-2 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                                    />
                                    <button
                                        onClick={handleJoinMatchClick}
                                         className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold rounded-lg hover:scale-105 transition shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>

                            {connectionStatus === 'connecting' && (
                                <div className="mt-4 text-center">
                                    <p className="text-yellow-400 animate-pulse">Connecting to server...</p>
                                    <p className="text-gray-400 text-sm">(Server can take up to {countdown} seconds to start.Wait!)</p>
                                </div>
                            )}

                            <p className="text-sm text-gray-500">
                                Share room code to challenge a friend. No login needed.
                            </p>
                        </div>
                    )}

                    {setupStep === 'createName' && (
                        <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col items-center space-y-6">
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
                        <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col items-center space-y-6">
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

<>
                  
                      {matchstart ? (
                       <Arena
                                socket={socket}
                                currentRoomId={currentRoomId}
                                playersInRoom={playersInRoom}
                                gameStatus={gameStatus}
                                currentProblem={currentProblem}
                                winnerId={winnerId}
                                setMessage={setMessage}
                                showCustomModal={showCustomModal}
                                leaveRoom={leaveRoom}
                                giveUp={giveUp}
                            />
                    ) : (

  <div className=" text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse mb-6">
        Match Starting In
      </h1>

      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="text-9xl font-black text-white drop-shadow-xl"
        >
          {count}
        </motion.div>
      </AnimatePresence>

      <p className="mt-8 text-gray-400 text-lg italic">Get ready to code!</p>
    </div>

                    ) }

</>
                 
                  


                   

                  
                )
            )}
            {(gameStatus === "waiting" && !currentRoomId) && (
        <div className="mt-16 w-full max-w-5xl">
  <h2 className="text-3xl font-extrabold text-gray-100 mb-10 text-center tracking-tight">
    Why Code Arena?
  </h2>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
    <div className="bg-gray-950/80 p-8 rounded-2xl border border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.08)] transition transform hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-white mb-3"> Real-Time Battles</h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        Live problem-solving. Compete instantly with anyone, anywhere.
      </p>
    </div>

    <div className="bg-gray-950/80 p-8 rounded-2xl border border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.08)] transition transform hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-white mb-3"> Fair Play</h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        Both users get the same challenges, with their own editors.
      </p>
    </div>

    <div className="bg-gray-950/80 p-8 rounded-2xl border border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.08)] transition transform hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-white mb-3"> Aura Farming</h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        Win matches, build your aura, and climb the arena rankings.
      </p>
    </div>
  </div>


                    <VideoTrial />
                </div>
            )}
        </div>
    );
}