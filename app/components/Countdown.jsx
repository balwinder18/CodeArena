"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Countdown() {
  const [count, setCount] = useState(10);
  const router = useRouter();

  useEffect(() => {
    if (count === 0) {
    //   router.push("/arena"); 
      return;
    }
    const timer = setTimeout(() => setCount((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, router]);

  return (
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
  );
}
