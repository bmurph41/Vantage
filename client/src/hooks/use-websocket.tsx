import { useEffect, useRef, useState } from 'react';

interface UseWebSocketReturn {
  lastMessage: string | null;
  connectionStatus: 'Connecting' | 'Open' | 'Closing' | 'Closed' | 'Uninstantiated';
  sendMessage: (message: string) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<UseWebSocketReturn['connectionStatus']>('Uninstantiated');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    const wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    
    ws.current = new WebSocket(wsUrl);
    setConnectionStatus('Connecting');

    ws.current.onopen = () => {
      setConnectionStatus('Open');
    };

    ws.current.onmessage = (event) => {
      setLastMessage(event.data);
    };

    ws.current.onclose = () => {
      setConnectionStatus('Closed');
    };

    ws.current.onerror = () => {
      setConnectionStatus('Closed');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (message: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(message);
    }
  };

  return {
    lastMessage,
    connectionStatus,
    sendMessage,
  };
}
