import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

let socket = null;

/**
 * Initializes and returns a singleton Socket.IO connection.
 * @returns {object} Socket instance
 */
export const initSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to real-time security log stream:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[SOCKET] Disconnected from stream:", reason);
    });

    socket.on("connect_error", (error) => {
      console.warn("[SOCKET] Connection error:", error.message);
    });
  }

  return socket;
};

/**
 * Returns active socket instance or initializes it.
 */
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

/**
 * Disconnects the socket.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
