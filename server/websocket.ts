import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  orgId?: string;
  isAlive?: boolean;
}

class DashboardWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true,
      path: '/ws/dashboard'
    });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      if (request.url?.startsWith('/ws/dashboard')) {
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.wss?.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
      console.log('📡 New dashboard WebSocket connection');
      
      ws.isAlive = true;
      
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('📡 Dashboard WebSocket connection closed');
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    this.startHeartbeat();
    
    console.log('✅ Dashboard WebSocket server initialized');
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: any) {
    if (message.type === 'auth') {
      ws.userId = message.userId;
      ws.orgId = message.orgId;
      
      if (ws.orgId) {
        if (!this.clients.has(ws.orgId)) {
          this.clients.set(ws.orgId, new Set());
        }
        this.clients.get(ws.orgId)?.add(ws);
        
        ws.send(JSON.stringify({ type: 'auth_success' }));
        console.log(`📡 Client authenticated for org: ${ws.orgId}`);
      }
    } else if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
  }

  private removeClient(ws: AuthenticatedWebSocket) {
    if (ws.orgId) {
      const orgClients = this.clients.get(ws.orgId);
      if (orgClients) {
        orgClients.delete(ws);
        if (orgClients.size === 0) {
          this.clients.delete(ws.orgId);
        }
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  }

  broadcastToOrg(orgId: string, message: any) {
    const orgClients = this.clients.get(orgId);
    if (!orgClients) return;

    const payload = JSON.stringify(message);
    orgClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  notifyDashboardUpdate(orgId: string, module: string, data?: any) {
    this.broadcastToOrg(orgId, {
      type: 'dashboard_update',
      module,
      data,
      timestamp: Date.now(),
    });
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss?.close();
  }
}

export const dashboardWS = new DashboardWebSocketServer();
