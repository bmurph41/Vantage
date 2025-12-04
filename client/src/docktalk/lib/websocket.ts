type MessageHandler = (message: any) => void;

export interface WebSocketController {
  socket: WebSocket | null;
  stop: () => void;
}

export function connectWebSocket(onMessage: MessageHandler): WebSocketController {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;

  const connect = () => {
    try {
      // Construct WebSocket URL from current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsPath = import.meta.env.VITE_WS_PATH || "/ws";
      const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
      
      
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        
        // Only attempt to reconnect if not intentionally stopped
        if (shouldReconnect) {
          reconnectTimer = setTimeout(() => {
            if (shouldReconnect) {
              connect();
            }
          }, 5000);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  };

  // Initial connection
  connect();

  // Return controller for cleanup
  return {
    get socket() {
      return socket;
    },
    stop: () => {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
    }
  };
}

export interface NewArticlePayload {
  id: number;
  title: string;
  url: string;
  source: string;
  category?: string;
  publishedAt?: string;
  relevanceScore?: number;
}

export interface FetchStatusPayload {
  type: 'fetch_started' | 'fetch_completed' | 'fetch_error';
  newArticles?: number;
  error?: string;
  timestamp: number;
  nextFetch?: string;
}

export interface WebSocketMessage {
  type: 'new_article' | 'fetch_status';
  payload: NewArticlePayload | FetchStatusPayload;
  timestamp: number;
}
