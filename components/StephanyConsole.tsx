"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Activity,
  Bot,
  MessageSquareText,
  Mic,
  PhoneCall,
  PhoneOff,
  Send,
  Volume2,
} from "lucide-react";

const STEPHANY_AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_STEPHANY_AGENT_ID?.trim() ||
  "agent_4101km8sfn8memhve210pcmpr5sb";
const STEPHANY_AGENT_NAME =
  process.env.NEXT_PUBLIC_ELEVENLABS_STEPHANY_AGENT_NAME?.trim() || "Stephany";

type ConnectionType = "webrtc" | "websocket";
type TranscriptRole = "system" | "user" | "agent";

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  timestamp: number;
}

function createTranscriptEntry(role: TranscriptRole, text: string): TranscriptEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: Date.now(),
  };
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unexpected ElevenLabs error.";
}

function clampMeterValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedString(
  value: unknown,
  path: string[],
): string | null {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === "string" ? current : null;
}

function parseConversationEvent(
  event: unknown,
): { role: TranscriptRole; text: string } | null {
  if (!isRecord(event) || typeof event.type !== "string") {
    return null;
  }

  if (event.type === "user_transcript") {
    const text = getNestedString(event, [
      "user_transcription_event",
      "user_transcript",
    ])?.trim();
    return text ? { role: "user", text } : null;
  }
  if (event.type === "agent_response") {
    const text = getNestedString(event, [
      "agent_response_event",
      "agent_response",
    ])?.trim();
    return text ? { role: "agent", text } : null;
  }
  if (event.type === "agent_response_correction") {
    const text = getNestedString(event, [
      "agent_response_correction_event",
      "corrected_agent_response",
    ])?.trim();
    return text ? { role: "agent", text } : null;
  }
  return null;
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "green" | "blue" | "purple" | "orange" | "red";
}) {
  const styles: Record<
    typeof tone,
    { background: string; color: string; border: string }
  > = {
    neutral: {
      background: "var(--fill-secondary)",
      color: "var(--text-secondary)",
      border: "1px solid var(--separator)",
    },
    green: {
      background: "rgba(48,209,88,0.10)",
      color: "var(--system-green)",
      border: "1px solid rgba(48,209,88,0.20)",
    },
    blue: {
      background: "rgba(10,132,255,0.10)",
      color: "var(--system-blue)",
      border: "1px solid rgba(10,132,255,0.20)",
    },
    purple: {
      background: "rgba(191,90,242,0.10)",
      color: "var(--system-purple)",
      border: "1px solid rgba(191,90,242,0.20)",
    },
    orange: {
      background: "rgba(255,159,10,0.12)",
      color: "var(--system-orange)",
      border: "1px solid rgba(255,159,10,0.22)",
    },
    red: {
      background: "rgba(255,69,58,0.10)",
      color: "var(--system-red)",
      border: "1px solid rgba(255,69,58,0.20)",
    },
  };

  const style = styles[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: "var(--text-caption1)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "-0.1px",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function Meter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-1)",
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
        }}
      >
        <span>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--fill-secondary)",
          border: "1px solid var(--separator)",
        }}
      >
        <div
          style={{
            width: `${Math.max(6, value * 100)}%`,
            maxWidth: "100%",
            height: "100%",
            borderRadius: 999,
            background: color,
            transition: "width 120ms linear",
          }}
        />
      </div>
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StephanyConsole() {
  const [connectionType, setConnectionType] = useState<ConnectionType>("webrtc");
  const [textDraft, setTextDraft] = useState("");
  const [contextDraft, setContextDraft] = useState("");
  const [outputVolume, setOutputVolume] = useState(0.85);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingContext, setTrainingContext] = useState("");
  const [trainingUpdatedAt, setTrainingUpdatedAt] = useState<string | null>(null);
  const [trainingAvailable, setTrainingAvailable] = useState(false);
  const [meters, setMeters] = useState({ input: 0, output: 0 });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() => [
    createTranscriptEntry(
      "system",
      "Stephany is ready. Start a session to talk live or send text once connected.",
    ),
  ]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recentLocalUserMessagesRef = useRef<Array<{ text: string; timestamp: number }>>(
    [],
  );
  const injectedTrainingSessionRef = useRef<string | null>(null);

  const pushTranscript = useCallback((role: TranscriptRole, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setTranscript((previous) => [
      ...previous.slice(-79),
      createTranscriptEntry(role, trimmed),
    ]);
  }, []);

  const pruneRecentLocalUserMessages = useCallback(() => {
    const cutoff = Date.now() - 5000;
    recentLocalUserMessagesRef.current = recentLocalUserMessagesRef.current.filter(
      (entry) => entry.timestamp >= cutoff,
    );
  }, []);

  const {
    startSession,
    endSession,
    sendContextualUpdate,
    sendUserActivity,
    sendUserMessage,
    setVolume,
    getInputVolume,
    getOutputVolume,
    status,
    isSpeaking,
  } = useConversation({
    onConnect: () => {
      setErrorMessage(null);
      pushTranscript("system", `Connected to ${STEPHANY_AGENT_NAME}.`);
    },
    onDisconnect: () => {
      setSessionId(null);
      setMeters({ input: 0, output: 0 });
      pushTranscript("system", "Session disconnected.");
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      pushTranscript("system", `Error: ${message}`);
    },
    onMessage: (event) => {
      pruneRecentLocalUserMessages();
      const parsed = parseConversationEvent(event);
      if (!parsed) {
        return;
      }

      if (parsed.role === "user") {
        const existingIndex = recentLocalUserMessagesRef.current.findIndex(
          (entry) =>
            entry.text === parsed.text && Date.now() - entry.timestamp < 5000,
        );
        if (existingIndex !== -1) {
          recentLocalUserMessagesRef.current.splice(existingIndex, 1);
          return;
        }
      }

      pushTranscript(parsed.role, parsed.text);
    },
  });

  const isConnected = status === "connected";
  const activeModeLabel = isConnected
    ? isSpeaking
      ? "Speaking"
      : "Listening"
    : "Idle";

  const statusTone = useMemo(() => {
    if (status === "connected") {
      return "green" as const;
    }
    if (status === "connecting" || status === "disconnecting") {
      return "orange" as const;
    }
    return "neutral" as const;
  }, [status]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrainingContext() {
      try {
        const response = await fetch("/api/stephany/training");
        if (!response.ok) {
          throw new Error("Failed to load Stephany training context.");
        }

        const payload: {
          exists?: boolean;
          context?: string;
          updatedAt?: string | null;
        } = await response.json();

        if (cancelled) {
          return;
        }

        const nextContext = (payload.context || "").trim();
        setTrainingAvailable(Boolean(payload.exists && nextContext));
        setTrainingContext(nextContext);
        setTrainingUpdatedAt(payload.updatedAt ?? null);
      } catch {
        if (!cancelled) {
          setTrainingAvailable(false);
          setTrainingContext("");
          setTrainingUpdatedAt(null);
        }
      }
    }

    void loadTrainingContext();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setMeters({ input: 0, output: 0 });
      return;
    }

    const intervalId = window.setInterval(() => {
      setMeters({
        input: clampMeterValue(getInputVolume()),
        output: clampMeterValue(getOutputVolume()),
      });
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [getInputVolume, getOutputVolume, isConnected]);

  useEffect(() => {
    if (!isConnected || !sessionId || !trainingContext) {
      return;
    }

    if (injectedTrainingSessionRef.current === sessionId) {
      return;
    }

    sendContextualUpdate(
      [
        "Stephany runtime coaching pack for this session:",
        trainingContext,
      ].join("\n\n"),
    );
    injectedTrainingSessionRef.current = sessionId;
    pushTranscript(
      "system",
      "Loaded shared Stephany training context from OpenClaw into this session.",
    );
  }, [isConnected, pushTranscript, sendContextualUpdate, sessionId, trainingContext]);

  const handleStartSession = useCallback(async () => {
    if (status === "connecting" || status === "connected") {
      return;
    }

    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot access a microphone.");
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const nextSessionId = await startSession({
        agentId: STEPHANY_AGENT_ID,
        connectionType,
      });
      setSessionId(nextSessionId);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      pushTranscript("system", `Unable to start session: ${message}`);
    }
  }, [connectionType, pushTranscript, startSession, status]);

  const handleStopSession = useCallback(async () => {
    if (status === "disconnected" || status === "disconnecting") {
      return;
    }

    await endSession();
  }, [endSession, status]);

  const handleSendTextMessage = useCallback(() => {
    const text = textDraft.trim();
    if (!text || !isConnected) {
      return;
    }

    sendUserMessage(text);
    recentLocalUserMessagesRef.current.push({
      text,
      timestamp: Date.now(),
    });
    pushTranscript("user", text);
    setTextDraft("");
  }, [isConnected, pushTranscript, sendUserMessage, textDraft]);

  const handleSendContextUpdate = useCallback(() => {
    const text = contextDraft.trim();
    if (!text || !isConnected) {
      return;
    }

    sendContextualUpdate(text);
    pushTranscript("system", `Context update sent: ${text}`);
    setContextDraft("");
  }, [contextDraft, isConnected, pushTranscript, sendContextualUpdate]);

  const handleOutputVolumeChange = useCallback(
    (nextVolume: number) => {
      setOutputVolume(nextVolume);
      setVolume({ volume: nextVolume });
    },
    [setVolume],
  );

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "var(--bg)" }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "var(--space-6) var(--space-4) var(--space-10)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <Card>
          <div
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-4)",
              }}
            >
              <div style={{ display: "flex", gap: "var(--space-4)" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background:
                      "linear-gradient(135deg, rgba(191,90,242,0.22), rgba(10,132,255,0.18))",
                    border: "1px solid rgba(191,90,242,0.20)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--system-purple)",
                    flexShrink: 0,
                  }}
                >
                  <Bot size={28} />
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "var(--text-title1)",
                        fontWeight: "var(--weight-bold)",
                        color: "var(--text-primary)",
                        letterSpacing: "-0.4px",
                      }}
                    >
                      {STEPHANY_AGENT_NAME}
                    </h1>
                    <StatusBadge label={status} tone={statusTone} />
                    <StatusBadge
                      label={activeModeLabel}
                      tone={isConnected ? "purple" : "neutral"}
                    />
                  </div>
                  <p
                    style={{
                      margin: "var(--space-2) 0 0",
                      fontSize: "var(--text-subheadline)",
                      color: "var(--text-secondary)",
                      lineHeight: "var(--leading-relaxed)",
                      maxWidth: 720,
                    }}
                  >
                    Live ElevenLabs Conversational AI inside ClawPort with voice
                    session controls, transcript history, direct text/context
                    updates, and shared runtime coaching from OpenClaw.
                  </p>
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                    }}
                  >
                    <StatusBadge
                      label={`Agent ID: ${STEPHANY_AGENT_ID}`}
                      tone="blue"
                    />
                    {sessionId ? (
                      <StatusBadge label={`Session: ${sessionId}`} tone="green" />
                    ) : (
                      <StatusBadge label="No active session" tone="neutral" />
                    )}
                    {trainingAvailable ? (
                      <StatusBadge
                        label={`Training pack synced${trainingUpdatedAt ? ` · ${formatDateTime(trainingUpdatedAt)}` : ""}`}
                        tone="purple"
                      />
                    ) : (
                      <StatusBadge label="No shared training pack" tone="neutral" />
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "0 var(--space-3)",
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--separator)",
                    background: "var(--fill-secondary)",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-footnote)",
                  }}
                >
                  <span>Transport</span>
                  <select
                    value={connectionType}
                    disabled={status !== "disconnected"}
                    onChange={(event) =>
                      setConnectionType(event.target.value as ConnectionType)
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-footnote)",
                      fontWeight: "var(--weight-semibold)",
                      cursor:
                        status === "disconnected" ? "pointer" : "not-allowed",
                    }}
                  >
                    <option value="webrtc">WebRTC</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={status === "connecting" || status === "connected"}
                  style={{
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    padding: "0 var(--space-4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    background:
                      status === "connected"
                        ? "var(--fill-tertiary)"
                        : "var(--accent)",
                    color:
                      status === "connected"
                        ? "var(--text-tertiary)"
                        : "var(--accent-contrast)",
                    cursor:
                      status === "connecting" || status === "connected"
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  <PhoneCall size={16} />
                  Start session
                </button>

                <button
                  type="button"
                  onClick={handleStopSession}
                  disabled={status === "disconnected" || status === "disconnecting"}
                  style={{
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(255,69,58,0.22)",
                    padding: "0 var(--space-4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    background: "rgba(255,69,58,0.10)",
                    color: "var(--system-red)",
                    cursor:
                      status === "disconnected" || status === "disconnecting"
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                    opacity:
                      status === "disconnected" || status === "disconnecting"
                        ? 0.5
                        : 1,
                  }}
                >
                  <PhoneOff size={16} />
                  Stop
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255,69,58,0.08)",
                  border: "1px solid rgba(255,69,58,0.20)",
                  color: "var(--system-red)",
                  fontSize: "var(--text-footnote)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {errorMessage}
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card style={{ minHeight: 0 }}>
            <div
              style={{
                padding: "var(--space-5)",
                borderBottom: "1px solid var(--separator)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-primary)",
                  }}
                >
                  <MessageSquareText size={16} />
                  Transcript
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: "var(--text-caption1)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Voice turns, text messages, and session events.
                </div>
              </div>
              <StatusBadge
                label={isConnected ? "Live" : "Waiting"}
                tone={isConnected ? "green" : "neutral"}
              />
            </div>

            <div
              style={{
                height: 520,
                overflowY: "auto",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              {transcript.map((entry) => {
                const isSystem = entry.role === "system";
                const isUser = entry.role === "user";

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isSystem
                        ? "center"
                        : isUser
                          ? "flex-end"
                          : "flex-start",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: isSystem ? "90%" : "82%",
                        padding: isSystem
                          ? "var(--space-2) var(--space-3)"
                          : "var(--space-3) var(--space-4)",
                        borderRadius: isSystem
                          ? "var(--radius-md)"
                          : isUser
                            ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
                            : "var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)",
                        background: isSystem
                          ? "var(--fill-secondary)"
                          : isUser
                            ? "var(--accent)"
                            : "var(--material-thin)",
                        border: isSystem
                          ? "1px solid var(--separator)"
                          : isUser
                            ? "none"
                            : "1px solid var(--separator)",
                        color: isSystem
                          ? "var(--text-secondary)"
                          : isUser
                            ? "var(--accent-contrast)"
                            : "var(--text-primary)",
                        fontSize: isSystem
                          ? "var(--text-footnote)"
                          : "var(--text-subheadline)",
                        lineHeight: "var(--leading-relaxed)",
                        boxShadow: isSystem ? "none" : "var(--shadow-subtle)",
                      }}
                    >
                      {entry.text}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-caption2)",
                        color: "var(--text-quaternary)",
                        padding: isSystem ? 0 : "0 4px",
                      }}
                    >
                      {entry.role === "agent"
                        ? STEPHANY_AGENT_NAME
                        : entry.role === "user"
                          ? "You"
                          : "System"}{" "}
                      · {formatTimestamp(entry.timestamp)}
                    </div>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>
          </Card>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            <Card>
              <div
                style={{
                  padding: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--weight-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Mic size={16} />
                    Session controls
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "var(--text-caption1)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Use voice live, or send text/context during the session.
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-4)",
                  }}
                >
                  <div
                    style={{
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--fill-secondary)",
                      border: "1px solid var(--separator)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-3)",
                        marginBottom: "var(--space-3)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "var(--text-footnote)",
                            fontWeight: "var(--weight-semibold)",
                            color: "var(--text-primary)",
                          }}
                        >
                          Audio activity
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: "var(--text-caption2)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          Live mic and output levels while connected.
                        </div>
                      </div>
                      <StatusBadge
                        label={isSpeaking ? "Stephany speaking" : "Stephany listening"}
                        tone={isConnected ? "purple" : "neutral"}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                      }}
                    >
                      <Meter
                        label="Mic input"
                        value={meters.input}
                        color="linear-gradient(90deg, #30d158, #64d2ff)"
                      />
                      <Meter
                        label="Speaker output"
                        value={meters.output}
                        color="linear-gradient(90deg, #bf5af2, #0a84ff)"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--fill-secondary)",
                      border: "1px solid var(--separator)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        marginBottom: "var(--space-2)",
                        fontSize: "var(--text-footnote)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Volume2 size={15} />
                      Output volume
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                      }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={outputVolume}
                        onChange={(event) =>
                          handleOutputVolumeChange(Number(event.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span
                        style={{
                          minWidth: 44,
                          textAlign: "right",
                          fontSize: "var(--text-caption1)",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {Math.round(outputVolume * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!isConnected}
                  onClick={() => {
                    sendUserActivity();
                    pushTranscript("system", "User activity signal sent.");
                  }}
                  style={{
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--separator)",
                    background: "var(--fill-secondary)",
                    color: isConnected
                      ? "var(--text-primary)"
                      : "var(--text-quaternary)",
                    cursor: isConnected ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  <Activity size={16} />
                  Send activity ping
                </button>
              </div>
            </Card>

            <Card>
              <div
                style={{
                  padding: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--weight-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Send size={16} />
                    Send text or context
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "var(--text-caption1)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Text messages trigger a reply. Context updates inform the
                    agent without forcing one.
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "var(--space-1)",
                        fontSize: "var(--text-caption1)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      User message
                    </label>
                    <textarea
                      value={textDraft}
                      onChange={(event) => setTextDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendTextMessage();
                        }
                      }}
                      placeholder={
                        isConnected
                          ? `Message ${STEPHANY_AGENT_NAME}...`
                          : "Start a session to send a text message."
                      }
                      rows={4}
                      disabled={!isConnected}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        minHeight: 110,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--separator)",
                        background: "var(--fill-secondary)",
                        color: "var(--text-primary)",
                        padding: "var(--space-3)",
                        fontSize: "var(--text-subheadline)",
                        lineHeight: "var(--leading-relaxed)",
                        opacity: isConnected ? 1 : 0.7,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!isConnected || !textDraft.trim()}
                    onClick={handleSendTextMessage}
                    style={{
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      background:
                        isConnected && textDraft.trim()
                          ? "var(--accent)"
                          : "var(--fill-tertiary)",
                      color:
                        isConnected && textDraft.trim()
                          ? "var(--accent-contrast)"
                          : "var(--text-quaternary)",
                      cursor:
                        isConnected && textDraft.trim()
                          ? "pointer"
                          : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2)",
                      fontSize: "var(--text-footnote)",
                      fontWeight: "var(--weight-semibold)",
                    }}
                  >
                    <MessageSquareText size={16} />
                    Send text message
                  </button>

                  <div
                    style={{
                      height: 1,
                      background: "var(--separator)",
                    }}
                  />

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "var(--space-1)",
                        fontSize: "var(--text-caption1)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Context update
                    </label>
                    <textarea
                      value={contextDraft}
                      onChange={(event) => setContextDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendContextUpdate();
                        }
                      }}
                      placeholder={
                        isConnected
                          ? "Example: User opened the pricing page and wants a live quote."
                          : "Start a session to send contextual updates."
                      }
                      rows={3}
                      disabled={!isConnected}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        minHeight: 88,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--separator)",
                        background: "var(--fill-secondary)",
                        color: "var(--text-primary)",
                        padding: "var(--space-3)",
                        fontSize: "var(--text-footnote)",
                        lineHeight: "var(--leading-relaxed)",
                        opacity: isConnected ? 1 : 0.7,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!isConnected || !contextDraft.trim()}
                    onClick={handleSendContextUpdate}
                    style={{
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--separator)",
                      background: "var(--fill-secondary)",
                      color:
                        isConnected && contextDraft.trim()
                          ? "var(--text-primary)"
                          : "var(--text-quaternary)",
                      cursor:
                        isConnected && contextDraft.trim()
                          ? "pointer"
                          : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2)",
                      fontSize: "var(--text-footnote)",
                      fontWeight: "var(--weight-semibold)",
                    }}
                  >
                    <Send size={16} />
                    Send context update
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
