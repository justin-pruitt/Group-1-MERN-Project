import { io } from "socket.io-client";

// No URL = same origin. Locally, vite.config.js proxies /socket.io to
// the backend on :5000. In production, the Apache vhost needs to proxy
// the /socket.io path to :5000 the same way it already proxies /api —
// see handoff.md.
export const socket = io({ autoConnect: false });
