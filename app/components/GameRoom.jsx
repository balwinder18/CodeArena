import React from 'react';

const GameRoom = ({
    socket,
    playerName,
    currentRoomId,
    playersInRoom,
    gameStatus,
    startGame
}) => {
    return (
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-6xl flex flex-col lg:flex-row gap-8">
            <div className="flex-1 flex flex-col space-y-6">
                <h2 className="text-3xl font-bold text-purple-400 mb-4">Room: {currentRoomId}</h2>
                <p className="text-gray-300 text-lg">Welcome, <span className="font-semibold text-yellow-300">{playerName}</span>!</p>

                <div className="w-full">
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">Players in this Room:</h3>
                    <ul className="list-disc list-inside text-gray-400">
                        {playersInRoom.map((player) => (
                            <li key={player.id} className="flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                {player.name} {player.id === socket?.id && <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">YOU</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {gameStatus === 'waiting' && playersInRoom.length < 2 && (
                    <div className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600 text-center">
                        <p className="text-xl text-gray-300">Waiting for another player to join...</p>
                        <p className="text-gray-400 text-sm mt-2">Share this Room ID: <span className="font-mono text-pink-300">{currentRoomId}</span></p>
                    </div>
                )}

                {gameStatus === 'waiting' && playersInRoom.length === 2 && (
                    <div className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600 text-center">
                        <p className="text-xl text-green-300 mb-4">Both players are in the room!</p>
                        <button
                            onClick={startGame}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                        >
                            Start Game
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameRoom;