"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type User = {
  id: number;
  email: string;
  name: string;
  skillLevel: string;
};

export default function CoachPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Loading...");
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check auth and start conversation
  useEffect(() => {
    const init = async () => {
      try {
        // Check auth
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();

        if (!authData.user) {
          router.push("/");
          return;
        }

        setUser(authData.user);
        setSessionStartTime(Date.now());

        // Get greeting from coach
        setStatus("Starting conversation...");
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isGreeting: true, history: [] }),
        });

        const chatData = await chatRes.json();
        if (chatData.response) {
          setMessages([{ role: "assistant", content: chatData.response }]);

          // Play greeting
          setStatus("Speaking...");
          await playAudio(chatData.response);
        }

        setStatus("Ready");
      } catch (error) {
        console.error("Init error:", error);
        setStatus("Error starting conversation");
      }
    };

    init();
  }, [router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keyboard handling - tap space to toggle recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isProcessing && !sessionEnded) {
        e.preventDefault();
        toggleRecording();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRecording, isProcessing, sessionEnded]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("Recording...");
    } catch (error) {
      console.error("Recording error:", error);
      setStatus("Microphone access denied");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);
    setIsProcessing(true);

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

    // Wait for data to be available
    await new Promise<void>((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => resolve();
      }
    });

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    await processAudio(audioBlob);
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Transcribe
      setStatus("Transcribing...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const transcribeData = await transcribeRes.json();

      if (!transcribeData.text || !transcribeData.text.trim()) {
        setStatus("Didn't catch that. Try again.");
        setIsProcessing(false);
        return;
      }

      const userMessage = transcribeData.text;

      // Add user message to UI
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

      // Get coach response
      setStatus("Thinking...");
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          isGreeting: false,
        }),
      });

      const chatData = await chatRes.json();

      if (chatData.response) {
        setMessages((prev) => [...prev, { role: "assistant", content: chatData.response }]);

        // Play response
        setStatus("Speaking...");
        await playAudio(chatData.response);
      }

      setStatus("Ready");
    } catch (error) {
      console.error("Processing error:", error);
      setStatus("Error processing. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = async (text: string) => {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        console.error("TTS error");
        return;
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play();
      });

      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const endSession = async () => {
    if (messages.length <= 1) {
      setSessionEnded(true);
      return;
    }

    setStatus("Saving session...");

    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "Coach" : user?.name}: ${m.content}`)
      .join("\n\n");

    const durationSeconds = sessionStartTime
      ? Math.floor((Date.now() - sessionStartTime) / 1000)
      : 0;

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, durationSeconds }),
      });

      const data = await res.json();

      // Show summary
      if (data.summary || data.skillNotes) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `--- Session Complete ---\n\nSummary: ${data.summary}\n\nSkill Notes: ${data.skillNotes}`,
          },
        ]);
      }
    } catch (error) {
      console.error("Save error:", error);
    }

    setSessionEnded(true);
    setStatus("Session ended");
  };

  const startNewConversation = async () => {
    setMessages([]);
    setSessionEnded(false);
    setSessionStartTime(Date.now());

    // Get greeting from coach
    setStatus("Starting conversation...");
    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGreeting: true, history: [] }),
      });

      const chatData = await chatRes.json();
      if (chatData.response) {
        setMessages([{ role: "assistant", content: chatData.response }]);

        // Play greeting
        setStatus("Speaking...");
        await playAudio(chatData.response);
      }

      setStatus("Ready");
    } catch (error) {
      console.error("Start error:", error);
      setStatus("Error starting conversation");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--accent)]">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-[var(--accent)]">Italian Conversation Coach</h1>
          <p className="text-sm opacity-60">
            {user.name} • {user.skillLevel}
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/sessions"
            className="text-[var(--foreground)] opacity-60 hover:opacity-100"
          >
            [Sessions]
          </Link>
          <button
            onClick={handleLogout}
            className="text-[var(--foreground)] opacity-60 hover:opacity-100"
          >
            [Logout]
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className="border border-[var(--border)] p-4">
            <div
              className={`font-bold mb-2 ${
                message.role === "assistant"
                  ? "text-[var(--accent)]"
                  : "text-[var(--user-color)]"
              }`}
            >
              {message.role === "assistant" ? "Coach Maria:" : `${user.name}:`}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Status bar */}
      <div className="border-t border-[var(--border)] pt-4">
        <div
          className={`text-center py-4 ${
            isRecording
              ? "text-red-500"
              : isProcessing
              ? "text-yellow-500"
              : sessionEnded
              ? "text-[var(--accent)]"
              : "text-[var(--foreground)] opacity-60"
          }`}
        >
          {status}
        </div>

        {sessionEnded ? (
          /* Session ended - show new conversation button */
          <button
            onClick={startNewConversation}
            className="w-full py-4 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors"
          >
            Start New Conversation
          </button>
        ) : (
          /* Active session controls */
          <div className="space-y-3">
            {/* Record button - tap to start/stop */}
            <button
              onClick={toggleRecording}
              disabled={isProcessing}
              className={`w-full py-6 text-lg border-2 transition-colors ${
                isRecording
                  ? "border-red-500 bg-red-500/10 text-red-500"
                  : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isRecording ? "Tap or Space to Stop" : "Tap or Space to Speak"}
            </button>

            {/* End conversation button */}
            <button
              onClick={endSession}
              disabled={isProcessing}
              className="w-full py-2 text-[var(--foreground)] opacity-60 hover:opacity-100 disabled:opacity-30"
            >
              [End Conversation]
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
