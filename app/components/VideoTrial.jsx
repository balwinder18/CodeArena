

'use client'


import { useRef } from 'react';

const VideoTrial = () => {
  const videoRef = useRef(null);

  const handleMouseEnter = () => {
  if (window.innerWidth >= 768 && videoRef.current) {
    videoRef.current.play().catch((e) => {
      
    });
  }
};

const handleMouseLeave = () => {
  if (window.innerWidth >= 768 && videoRef.current) {
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }
};

  return (
  <section className="mt-16 w-full max-w-7xl mx-auto px-4 md:px-8">
  <div className="flex flex-col md:flex-row gap-12 items-center">
    
    <div className="w-full md:w-1/2 text-center md:text-left">
      <h2 className="text-4xl font-bold text-white mb-6">
        How It Works
      </h2>
      <p className="text-gray-400 text-lg leading-relaxed">
        Code Arena lets you challenge others in real-time DSA battles. Enter a room, solve the same problem, and the first to finish wins. No signups,just pure code combat.
      </p>
    </div>

   
    <div
      className="w-full md:w-1/2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src="/video/trial.mp4"
        muted
        playsInline
        loading="lazy"
        controls
        poster="/video/codeArena.PNG"
        className="w-full aspect-video rounded-xl shadow-2xl border border-gray-700"
         onVolumeChange={(e) => e.target.muted = true}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</section>

  );
};

export default VideoTrial;
