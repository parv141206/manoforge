"use client";
import dynamic from "next/dynamic";
import React from "react";
import { motion } from "motion/react";
import Link from "next/link";

const Editor = dynamic(() => import("@/components/editor/editor"), {
  ssr: false,
});

const ShaderCanvas = dynamic(() => import("@/components/shader-canvas"), {
  ssr: false,
});

export default function HomePage() {
  const [started, setStarted] = React.useState(false);
  const [heroMounted, setHeroMounted] = React.useState(true);

  const startSequence = React.useCallback(() => {
    if (started) return;
    setStarted(true);
    setTimeout(() => setHeroMounted(false), 300);
  }, [started]);

  return (
    <>
      {heroMounted && (
        <main className="font-body relative flex h-screen w-full flex-col items-center justify-center gap-10 overflow-hidden bg-black">
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={
              started
                ? {
                    scale: 1.5,
                    opacity: 0,
                    filter: "blur(3px)",
                  }
                : {
                    scale: 1,
                    opacity: 1,
                    filter: "blur(0px)",
                  }
            }
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <ShaderCanvas />
          </motion.div>

          <motion.div
            className="font-title absolute bottom-6 left-4 z-5 flex w-[90%] flex-col text-red-500 drop-shadow-2xl drop-shadow-black text-shadow-black text-shadow-lg sm:bottom-10 sm:left-10 sm:w-1/2"
            animate={
              started
                ? {
                    x: -260,
                    y: 260,
                    opacity: 0,
                  }
                : {
                    x: 0,
                    y: 0,
                    opacity: 1,
                  }
            }
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-4xl sm:text-6xl md:text-9xl">Mano Forge</div>
            <div className="font-body text-sm sm:text-xl md:text-3xl">
              A simulator based on Morris Mano&apos;s basic architecture of a
              computer!
            </div>
          </motion.div>

          <motion.div
            className="font-body absolute top-4 right-4 z-5 text-sm text-yellow-500 drop-shadow-2xl drop-shadow-black text-shadow-black text-shadow-lg sm:top-10 sm:right-10 sm:text-xl md:text-3xl"
            animate={
              started
                ? {
                    x: 260,
                    y: -260,
                    opacity: 0,
                  }
                : {
                    x: 0,
                    y: 0,
                    opacity: 1,
                  }
            }
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            Dive in lore that started it all!
          </motion.div>

          <motion.div
            className="font-body z-5 px-4 text-center text-sm text-yellow-500 drop-shadow-2xl drop-shadow-black text-shadow-black text-shadow-lg sm:text-xl md:text-3xl"
            animate={
              started
                ? {
                    y: -220,
                    opacity: 0,
                  }
                : {
                    y: 0,
                    opacity: 1,
                  }
            }
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            Long time ago, in a galaxy far, far away...
          </motion.div>

          <motion.button
            onClick={startSequence}
            className={`z-5 border-2 border-yellow-500 bg-yellow-500 px-3 py-1 text-xl font-bold text-black focus:outline-none sm:text-2xl md:text-3xl ${
              started
                ? "pointer-events-none cursor-default"
                : "cursor-pointer hover:bg-transparent hover:text-yellow-500"
            }`}
            animate={
              started
                ? {
                    opacity: 0,
                    scale: 0.9,
                  }
                : {
                    opacity: 1,
                    scale: 1,
                  }
            }
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            LETS GO!
          </motion.button>
          <motion.div
            animate={
              started
                ? {
                    opacity: 0,
                  }
                : {
                    opacity: 1,
                  }
            }
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="z-5"
          >
            <Link
              target="_blank"
              href={"https://github.com/parv141206"}
              className="z-5 text-lg text-gray-400 transition-colors hover:text-gray-200"
            >
              Made with ❤️ by Parv Shah
            </Link>
          </motion.div>
        </main>
      )}

      {started && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeInOut" }}
        >
          <Editor />
        </motion.div>
      )}
    </>
  );
}
