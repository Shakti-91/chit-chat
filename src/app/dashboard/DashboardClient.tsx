"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

type UserSummary = { id: string; username: string };
type RoomSummary = { id: string; name: string; code: string; memberCount: number };

type ChatTarget =
  | { type: "dm"; id: string; label: string }
  | { type: "room"; id: string; label: string; code: string };

type DmMessage = {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
};

type RoomMessageItem = {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  createdAt: string;
  sender: { id: string; username: string };
};

const POLL_INTERVAL_MS = 2500;

export default function DashboardClient({
  currentUserId,
  currentUsername,
}: {
  currentUserId: string;
  currentUsername: string;
}) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatTarget | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSidebarData = useCallback(async () => {
    const [usersRes, roomsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/rooms"),
    ]);
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users);
    }
    if (roomsRes.ok) {
      const data = await roomsRes.json();
      setRooms(data.rooms);
    }
  }, []);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  const fetchMessages = useCallback(async (target: ChatTarget) => {
    if (target.type === "dm") {
      const res = await fetch(`/api/messages/${target.id}`);
      if (res.ok) {
        const data = await res.json();
        setDmMessages(data.messages);
      }
    } else {
      const res = await fetch(`/api/rooms/${target.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setRoomMessages(data.messages);
      }
    }
  }, []);

  // Poll the active conversation for new messages
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeChat) return;

    fetchMessages(activeChat);
    pollRef.current = setInterval(() => fetchMessages(activeChat), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChat, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages, roomMessages]);

  function openDm(user: UserSummary) {
    setActiveChat({ type: "dm", id: user.id, label: user.username });
    setDmMessages([]);
  }

  function openRoom(room: RoomSummary) {
    setActiveChat({ type: "room", id: room.id, label: room.name, code: room.code });
    setRoomMessages([]);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChat || !draft.trim() || sending) return;

    setSending(true);
    const content = draft.trim();
    setDraft("");

    const url =
      activeChat.type === "dm"
        ? `/api/messages/${activeChat.id}`
        : `/api/rooms/${activeChat.id}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      fetchMessages(activeChat);
    }
    setSending(false);
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    if (!roomNameInput.trim()) {
      setModalError("Room name is required.");
      return;
    }
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: roomNameInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setModalError(data.error ?? "Could not create room.");
      return;
    }
    setShowCreateRoom(false);
    setRoomNameInput("");
    await loadSidebarData();
    openRoom({ id: data.room.id, name: data.room.name, code: data.room.code, memberCount: 1 });
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    if (!roomCodeInput.trim()) {
      setModalError("Room code is required.");
      return;
    }
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCodeInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setModalError(data.error ?? "Could not join room.");
      return;
    }
    setShowJoinRoom(false);
    setRoomCodeInput("");
    await loadSidebarData();
    openRoom({
      id: data.room.id,
      name: data.room.name,
      code: data.room.code,
      memberCount: 0,
    });
  }

  const displayedMessages =
    activeChat?.type === "dm"
      ? dmMessages.map((m) => ({
          id: m.id,
          content: m.content,
          isOwn: m.senderId === currentUserId,
          senderLabel: m.senderId === currentUserId ? "You" : activeChat.label,
          createdAt: m.createdAt,
        }))
      : roomMessages.map((m) => ({
          id: m.id,
          content: m.content,
          isOwn: m.senderId === currentUserId,
          senderLabel: m.senderId === currentUserId ? "You" : m.sender.username,
          createdAt: m.createdAt,
        }));

  return (
    <div className="flex h-screen w-full bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-semibold text-slate-900">{currentUsername}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Log out
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Direct messages
              </h2>
            </div>
            <ul className="mt-2 space-y-1">
              {users.length === 0 && (
                <li className="py-2 text-sm text-slate-400">No other users yet.</li>
              )}
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => openDm(u)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                      activeChat?.type === "dm" && activeChat.id === u.id
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {u.username.slice(0, 2).toUpperCase()}
                    </span>
                    {u.username}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 px-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rooms
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setModalError(null);
                    setShowCreateRoom(true);
                  }}
                  title="Create room"
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                >
                  + New
                </button>
                <button
                  onClick={() => {
                    setModalError(null);
                    setShowJoinRoom(true);
                  }}
                  title="Join room"
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Join
                </button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 pb-4">
              {rooms.length === 0 && (
                <li className="py-2 text-sm text-slate-400">No rooms joined yet.</li>
              )}
              {rooms.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => openRoom(r)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition ${
                      activeChat?.type === "room" && activeChat.id === r.id
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        #
                      </span>
                      {r.name}
                    </span>
                    <span className="text-xs text-slate-400">{r.memberCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Chat window */}
      <main className="flex flex-1 flex-col">
        {!activeChat ? (
          <div className="flex flex-1 items-center justify-center text-slate-400">
            Select a direct message or a room to start chatting.
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h1 className="font-semibold text-slate-900">
                  {activeChat.type === "dm" ? activeChat.label : `# ${activeChat.label}`}
                </h1>
                {activeChat.type === "room" && (
                  <p className="text-xs text-slate-400">
                    Room code:{" "}
                    <span className="font-mono font-medium text-slate-500">
                      {activeChat.code}
                    </span>{" "}
                    — share it so others can join.
                  </p>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {displayedMessages.length === 0 && (
                <p className="text-sm text-slate-400">No messages yet. Say hello!</p>
              )}
              {displayedMessages.map((m) => (
                <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-sm rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      m.isOwn
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-800 ring-1 ring-slate-200"
                    }`}
                  >
                    {!m.isOwn && activeChat.type === "room" && (
                      <p className="mb-0.5 text-xs font-semibold text-brand-600">
                        {m.senderLabel}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        m.isOwn ? "text-brand-100" : "text-slate-400"
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        )}
      </main>

      {/* Create room modal */}
      {showCreateRoom && (
        <Modal onClose={() => setShowCreateRoom(false)} title="Create a room">
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Room name</label>
              <input
                autoFocus
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="e.g. Design Team"
              />
            </div>
            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Create room
            </button>
          </form>
        </Modal>
      )}

      {/* Join room modal */}
      {showJoinRoom && (
        <Modal onClose={() => setShowJoinRoom(false)} title="Join a room">
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Room code</label>
              <input
                autoFocus
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase tracking-widest focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="e.g. A1B2C3"
              />
            </div>
            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Join room
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
