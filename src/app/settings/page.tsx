"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Personality = {
  id: string;
  name: string;
  description: string;
  voice: string;
};

// Italian dad jokes for preview samples
const ITALIAN_DAD_JOKES = [
  "Perche il pomodoro e diventato rosso? Perche ha visto l'insalata nuda!",
  "Cosa fa un gallo in chiesa? Il canto del chicchiricchi!",
  "Perche i pesci non vanno a scuola? Perche stanno sempre in branchi!",
  "Cosa dice un muro all'altro muro? Ci vediamo all'angolo!",
  "Perche la mucca guarda sempre il cielo? Perche cerca la via lattea!",
  "Cosa ordina un informatico al bar? Un byte!",
  "Perche il libro di matematica e triste? Perche ha troppi problemi!",
  "Cosa fa una lumaca su una tartaruga? Si gode il viaggio!",
  "Perche il gatto non gioca a poker? Perche ha sempre le zampe sul tavolo!",
  "Cosa dice il caffe al latte? Senza di te non sono niente!",
];

const SPEED_LABELS: Record<number, string> = {
  0.5: "Very Slow",
  0.6: "Slow",
  0.7: "Moderately Slow",
  0.8: "Slightly Slow",
  0.85: "Default",
  0.9: "Normal",
  1.0: "Standard",
  1.1: "Slightly Fast",
  1.2: "Fast",
  1.3: "Very Fast",
};

export default function SettingsPage() {
  const router = useRouter();
  const [currentSpeed, setCurrentSpeed] = useState(0.85);
  const [selectedSpeed, setSelectedSpeed] = useState(0.85);
  const [speedOptions, setSpeedOptions] = useState<number[]>([]);
  const [currentPersonality, setCurrentPersonality] = useState("maria");
  const [selectedPersonality, setSelectedPersonality] = useState("maria");
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();

        if (!authData.user) {
          router.push("/");
          return;
        }

        const settingsRes = await fetch("/api/settings");
        const settingsData = await settingsRes.json();

        if (settingsData.ttsSpeed) {
          setCurrentSpeed(settingsData.ttsSpeed);
          setSelectedSpeed(settingsData.ttsSpeed);
        }
        if (settingsData.ttsSpeedOptions) {
          setSpeedOptions(settingsData.ttsSpeedOptions);
        }
        if (settingsData.personality) {
          setCurrentPersonality(settingsData.personality);
          setSelectedPersonality(settingsData.personality);
        }
        if (settingsData.personalities) {
          setPersonalities(settingsData.personalities);
        }

        setLoading(false);
      } catch (error) {
        console.error("Fetch settings error:", error);
        setLoading(false);
      }
    };

    fetchSettings();
  }, [router]);

  const playPreview = async () => {
    if (playing) return;

    setPlaying(true);

    try {
      // Pick a random dad joke
      const joke = ITALIAN_DAD_JOKES[Math.floor(Math.random() * ITALIAN_DAD_JOKES.length)];

      // Get the voice for the selected personality
      const personality = personalities.find((p) => p.id === selectedPersonality);
      const voice = personality?.voice || "nova";

      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: joke, speed: selectedSpeed, voice }),
      });

      if (!res.ok) {
        throw new Error("TTS failed");
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("Preview error:", error);
      setPlaying(false);
    }
  };

  const hasChanges =
    selectedSpeed !== currentSpeed || selectedPersonality !== currentPersonality;

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ttsSpeed: selectedSpeed,
          personality: selectedPersonality,
        }),
      });

      if (res.ok) {
        setCurrentSpeed(selectedSpeed);
        setCurrentPersonality(selectedPersonality);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--accent)]">Loading settings...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border)]">
        <h1 className="text-2xl text-[var(--accent)]">Settings</h1>
        <Link
          href="/coach"
          className="text-[var(--accent)] hover:underline"
        >
          [Back to Coach]
        </Link>
      </div>

      {/* Coach Personality Setting */}
      <div className="border border-[var(--border)] p-6 mb-6">
        <h2 className="text-lg text-[var(--accent)] mb-4">Coach Personality</h2>
        <p className="text-[var(--foreground)] opacity-60 mb-6">
          Choose your conversation coach. Each has a unique teaching style and voice.
        </p>

        <div className="space-y-3 mb-4">
          {personalities.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPersonality(p.id)}
              className={`w-full p-4 border text-left transition-colors ${
                selectedPersonality === p.id
                  ? "border-[var(--accent)] bg-[var(--accent)] bg-opacity-10"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className={`font-medium ${
                    selectedPersonality === p.id
                      ? "text-[var(--accent)]"
                      : "text-[var(--foreground)]"
                  }`}>
                    {p.name}
                  </span>
                  {p.id === currentPersonality && (
                    <span className="ml-2 text-xs opacity-60">(current)</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--foreground)] opacity-60 mt-1">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Speech Speed Setting */}
      <div className="border border-[var(--border)] p-6 mb-6">
        <h2 className="text-lg text-[var(--accent)] mb-4">Speech Speed</h2>
        <p className="text-[var(--foreground)] opacity-60 mb-6">
          Adjust how fast your coach speaks. Slower speeds can help with comprehension.
        </p>

        {/* Speed Selector */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-[var(--foreground)] opacity-60 mb-2">
            <span>Slower</span>
            <span>Faster</span>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => setSelectedSpeed(speed)}
                className={`py-3 border transition-colors ${
                  selectedSpeed === speed
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                    : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {speed}
              </button>
            ))}
          </div>

          <div className="text-center text-[var(--foreground)]">
            <span className="opacity-60">Selected: </span>
            <span className="text-[var(--accent)]">
              {SPEED_LABELS[selectedSpeed] || selectedSpeed}
            </span>
            {selectedSpeed === currentSpeed && (
              <span className="opacity-60"> (current)</span>
            )}
          </div>
        </div>
      </div>

      {/* Preview Button */}
      <button
        onClick={playPreview}
        disabled={playing}
        className={`w-full py-3 mb-4 border transition-colors ${
          playing
            ? "border-yellow-500 text-yellow-500"
            : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
        }`}
      >
        {playing ? "Playing..." : `Preview ${personalities.find((p) => p.id === selectedPersonality)?.name || "Voice"}`}
      </button>

      <p className="text-sm text-[var(--foreground)] opacity-60 text-center mb-6">
        Plays a random Italian phrase with the selected coach and speed
      </p>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving || !hasChanges}
        className={`w-full py-3 border transition-colors ${
          saved
            ? "border-green-500 text-green-500"
            : !hasChanges
            ? "border-[var(--border)] text-[var(--foreground)] opacity-30 cursor-not-allowed"
            : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
        }`}
      >
        {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
      </button>
    </main>
  );
}
