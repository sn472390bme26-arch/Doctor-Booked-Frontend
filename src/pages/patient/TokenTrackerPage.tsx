import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import { SESSION_TIMES } from "../../data/seed";
import { useRouter } from "../../router/RouterContext";
import type { SessionType, TokenStatus } from "../../types";

const TOKEN_CLASSES: Record<TokenStatus, string> = {
  white: "token-white",
  red: "token-red",
  orange: "token-orange",
  yellow: "token-yellow",
  green: "token-green",
  unvisited: "bg-gray-100 border-2 border-gray-200 text-gray-400",
};

const STATUS_LABELS: Record<TokenStatus, string> = {
  white: "Available",
  red: "Booked - Waiting",
  orange: "Currently Being Seen",
  yellow: "Next Up",
  green: "Completed",
  unvisited: "Unvisited",
};

interface Props {
  sessionId: string;
  tokenNumber: number;
}

export default function TokenTrackerPage({ sessionId, tokenNumber }: Props) {
  const { goBack } = useRouter();
  const { tokenStates, bookings, doctors, refreshFromStorage, getOrCreateTokenState } = useStore();

  useEffect(() => {
    // Subscribe via WebSocket for live updates; fall back to polling every 5s
    getOrCreateTokenState(sessionId, "", "", "morning");
    const id = setInterval(refreshFromStorage, 5000);
    return () => clearInterval(id);
  }, [sessionId]); // eslint-disable-line

  const booking = bookings.find(
    (b) => b.sessionId === sessionId && b.tokenNumber === tokenNumber,
  );
  const tokenState = tokenStates[sessionId];
  const doctor = booking
    ? doctors.find((d) => d.id === booking.doctorId)
    : null;
  const maxTokens = doctor?.tokensPerSession ?? 30;
  const statuses = tokenState?.tokenStatuses ?? {};
  const myStatus: TokenStatus = (statuses[tokenNumber] as TokenStatus) ?? "red";

  const completedCount = Object.values(statuses).filter(
    (s) => s === "green",
  ).length;
  const bookedCount = Object.values(statuses).filter(
    (s) => s === "red" || s === "orange" || s === "yellow",
  ).length;
  const ongoingToken = Object.entries(statuses).find(
    ([, s]) => s === "orange",
  )?.[0];
  const tokensAhead = ongoingToken
    ? Object.entries(statuses).filter(
        ([n, s]) => (s === "red" || s === "yellow") && Number(n) < tokenNumber,
      ).length
    : 0;

  function getStatusMsg() {
    switch (myStatus) {
      case "green":
        return {
          text: "Your consultation is complete.",
          color: "text-green-600",
          bg: "bg-green-50 border-green-200",
        };
      case "orange":
        return {
          text: "You are currently being seen by the doctor!",
          color: "text-orange-600",
          bg: "bg-orange-50 border-orange-200",
        };
      case "yellow":
        return {
          text: "You're next! Please be ready at the counter.",
          color: "text-amber-600",
          bg: "bg-amber-50 border-amber-200",
        };
      case "red":
        return {
          text: `You're in the queue. ${tokensAhead} token${tokensAhead !== 1 ? "s" : ""} ahead.`,
          color: "text-teal-600",
          bg: "bg-teal-50 border-teal-200",
        };
      case "unvisited":
        return {
          text: "Session closed. Refund will be processed.",
          color: "text-red-600",
          bg: "bg-red-50 border-red-200",
        };
      default:
        return { text: "", color: "", bg: "" };
    }
  }

  const msg = getStatusMsg();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        data-ocid="tracker.button"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> My Bookings
      </button>

      {/* Tracker header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="animate-pulse bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              LIVE
            </span>
            <span className="text-xs text-gray-400">
              Updates every 5 seconds
            </span>
          </div>
          <button
            type="button"
            className="text-xs border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Share Queue
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Live Queue Tracker
            </h1>
            {booking && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {booking.doctorName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {booking.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {SESSION_TIMES[booking.session as SessionType]?.label}
                </span>
              </div>
            )}
          </div>
          {/* Your token badge */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center min-w-[100px] shrink-0">
            <p className="text-xs font-semibold text-teal-500 tracking-wide">
              YOUR TOKEN
            </p>
            <p className="text-3xl font-bold text-teal-600">#{tokenNumber}</p>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                myStatus === "green"
                  ? "bg-green-100 text-green-700"
                  : myStatus === "orange"
                    ? "bg-orange-100 text-orange-700"
                    : myStatus === "yellow"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-teal-100 text-teal-700"
              }`}
            >
              {STATUS_LABELS[myStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            icon: <CheckCircle className="w-4 h-4 text-teal-600" />,
            bg: "bg-teal-100",
            value: bookedCount + completedCount,
            label: "Total Booked",
          },
          {
            icon: <CheckCircle className="w-4 h-4 text-green-600" />,
            bg: "bg-green-100",
            value: completedCount,
            label: "Completed",
          },
          {
            icon: <Clock className="w-4 h-4 text-orange-600" />,
            bg: "bg-orange-100",
            value: ongoingToken ?? "-",
            label: "Now Seeing",
          },
          {
            icon: <Activity className="w-4 h-4 text-blue-600" />,
            bg: "bg-blue-100",
            value: tokensAhead,
            label: "Tokens Ahead",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <div
              className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}
            >
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Queue Board */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Queue Board</h2>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {(
            [
              ["white", "Available"],
              ["red", "Booked"],
              ["orange", "Ongoing"],
              ["yellow", "Next Up"],
              ["green", "Completed"],
            ] as [TokenStatus, string][]
          ).map(([s, label]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded-full token-${s}`}
                style={{
                  backgroundColor:
                    s === "white"
                      ? "#e2e8f0"
                      : s === "red"
                        ? "#ef4444"
                        : s === "orange"
                          ? "#f97316"
                          : s === "yellow"
                            ? "#fbbf24"
                            : "#22c55e",
                }}
              />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
        {/* Token grid */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxTokens }, (_, i) => i + 1).map((n) => {
            const st: TokenStatus = (statuses[n] as TokenStatus) ?? "white";
            const isMe = n === tokenNumber;
            return (
              <div
                key={n}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                  TOKEN_CLASSES[st] ?? "token-white"
                } ${isMe ? "ring-4 ring-blue-500 ring-offset-1 scale-110" : ""}`}
                title={STATUS_LABELS[st]}
              >
                {n}
                {isMe && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Blue ring indicates your token
        </p>
      </div>

      {/* Your Queue Position */}
      <div className={`rounded-2xl border p-5 ${msg.bg}`}>
        <h3 className="font-semibold text-gray-900 mb-1">
          Your Queue Position
        </h3>
        <p className={`text-sm font-medium ${msg.color}`}>{msg.text}</p>
      </div>
    </div>
  );
}
