import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';

interface DashboardMessage {
  type: string;
  module?: string;
  data?: any;
  timestamp?: number;
}

export function useDashboardWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<DashboardMessage | null>(null);

  const connect = useCallback(() => {
    if (!user?.id || !user?.organization_id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/dashboard`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📡 Dashboard WebSocket connected');
        setIsConnected(true);
        
        ws.send(JSON.stringify({
          type: 'auth',
          userId: user.id,
          orgId: user.organization_id,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: DashboardMessage = JSON.parse(event.data);
          
          if (message.type === 'dashboard_update') {
            console.log('📊 Dashboard update received:', message.module);
            setLastUpdate(message);
            
            queryClient.invalidateQueries({ 
              queryKey: ['/api/dashboards/data'] 
            });
          } else if (message.type === 'pong') {
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('📡 Dashboard WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('📡 Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('📡 Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [user?.id, user?.organization_id]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  return {
    isConnected,
    lastUpdate,
    sendPing,
  };
}
