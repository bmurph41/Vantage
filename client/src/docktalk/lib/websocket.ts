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
      
      console.log("Connecting to WebSocket:", wsUrl);
      
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);
          onMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        
        // Only attempt to reconnect if not intentionally stopped
        if (shouldReconnect) {
          console.log("Will attempt to reconnect in 5s");
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
      console.log("WebSocket controller stopped");
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

export interface WebSocketMessage {
  type: string;
  payload: NewArticlePayload;
  timestamp: number;
}
