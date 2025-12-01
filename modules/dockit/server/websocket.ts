import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import type { RequestHandler } from 'express';
import cookie from 'cookie';
import cookieParser from 'cookie-parser';
import { log } from './vite';
import { storage } from './storage';

interface WebSocketClient extends WebSocket {
  userId?: string;
  userType?: 'customer' | 'staff';
  isAlive?: boolean;
}

interface MessagePayload {
  type: 'message' | 'thread_update' | 'typing' | 'read_receipt' | 'authenticated';
  data?: any;
  userId?: string;
  userType?: string;
}

class MessageWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>> = new Map();
  private threadParticipantsCache: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sessionParser: RequestHandler;
  private sessionSecret: string;

  constructor(server: HTTPServer, sessionParser: RequestHandler, sessionSecret: string) {
    this.sessionParser = sessionParser;
    this.sessionSecret = sessionSecret;
    
    // Create WebSocket server without automatic upgrade
    this.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade manually to verify session
    server.on('upgrade', (request, socket, head) => {
      if (request.url !== '/ws/messages') {
        // Not our WebSocket path, ignore
        return;
      }

      // Parse session using express-session middleware
      (this.sessionParser as any)(request, {}, () => {
        const session = (request as any).session;
        
        // In development mode, allow bypass if no proper session exists
        if (process.env.NODE_ENV === 'development') {
          if (!session || !session.userId) {
            log('WebSocket: Development mode - allowing connection without session');
            // Create a mock session for development
            (request as any).session = {
              userId: 'demo-staff-1',
              user: { id: 'demo-staff-1', email: 'staff@marina.com' },
              isDevBypass: true
            };
          }
        } else {
          // Production mode - require valid session
          if (!session || !session.userId) {
            log('WebSocket: Unauthorized - no valid session');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
        }

        // Session is valid, proceed with WebSocket upgrade
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      });
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    
    log('WebSocket server initialized on /ws/messages');
  }

  private async handleConnection(ws: WebSocketClient, req: any) {
    log('WebSocket client connecting');
    
    // Extract userId and userType from session
    const session = req.session;
    if (!session || !session.userId) {
      log('WebSocket: No session found, closing connection');
      ws.close(1008, 'Unauthorized');
      return;
    }

    const userId = session.userId;
    const userType = session.user?.isStaff ? 'staff' : 'customer';
    
    // Authenticate the client with session-verified credentials
    this.authenticateClient(ws, userId, userType);
    this.setupMessageHandlers(ws);
    
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      log('WebSocket client disconnected');
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      log('WebSocket error:', error);
      this.removeClient(ws);
    });
  }

  private setupMessageHandlers(ws: WebSocketClient) {
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        log('WebSocket message parse error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });
  }

  private handleMessage(ws: WebSocketClient, message: any) {
    switch (message.type) {
      case 'typing':
        if (ws.userId && message.threadId) {
          this.broadcastToThread(message.threadId, {
            type: 'typing',
            data: {
              userId: ws.userId,
              userType: ws.userType,
              threadId: message.threadId,
              isTyping: message.isTyping
            }
          }, ws.userId);
        }
        break;
      default:
        log('Unknown message type:', message.type);
    }
  }

  private authenticateClient(ws: WebSocketClient, userId: string, userType: 'customer' | 'staff') {
    ws.userId = userId;
    ws.userType = userType;
    
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
    
    log(`WebSocket client authenticated: ${userId} (${userType})`);
    ws.send(JSON.stringify({ 
      type: 'authenticated', 
      userId, 
      userType 
    }));
  }

  private removeClient(ws: WebSocketClient) {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as WebSocketClient;
        if (client.isAlive === false) {
          log('Terminating inactive WebSocket client');
          return client.terminate();
        }
        
        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds
  }

  private async getThreadParticipants(threadId: string): Promise<Set<string>> {
    // Check cache first
    if (this.threadParticipantsCache.has(threadId)) {
      return this.threadParticipantsCache.get(threadId)!;
    }
    
    // Fetch from storage and cache
    const participants = await storage.getMessageThreadParticipants(threadId);
    const participantSet = new Set(participants);
    this.threadParticipantsCache.set(threadId, participantSet);
    
    return participantSet;
  }

  private invalidateThreadCache(threadId: string) {
    this.threadParticipantsCache.delete(threadId);
  }

  public broadcastToUser(userId: string, payload: MessagePayload) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify(payload);
      userClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  public async broadcastToThread(threadId: string, payload: MessagePayload, excludeUserId?: string) {
    const participants = await this.getThreadParticipants(threadId);
    const message = JSON.stringify(payload);
    
    participants.forEach((userId) => {
      if (userId !== excludeUserId) {
        const userClients = this.clients.get(userId);
        if (userClients) {
          userClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      }
    });
  }

  public async notifyNewMessage(threadId: string, message: any, recipientUserIds: string[]) {
    const payload: MessagePayload = {
      type: 'message',
      data: {
        threadId,
        message
      }
    };

    recipientUserIds.forEach((userId) => {
      this.broadcastToUser(userId, payload);
    });
  }

  public async notifyThreadUpdate(threadId: string, update: any, userIds: string[]) {
    // Invalidate cache when thread is updated
    this.invalidateThreadCache(threadId);
    
    const payload: MessagePayload = {
      type: 'thread_update',
      data: {
        threadId,
        update
      }
    };

    userIds.forEach((userId) => {
      this.broadcastToUser(userId, payload);
    });
  }

  public async notifyReadReceipt(threadId: string, messageId: string, userId: string) {
    const payload: MessagePayload = {
      type: 'read_receipt',
      data: {
        threadId,
        messageId,
        userId,
        readAt: new Date().toISOString()
      }
    };

    await this.broadcastToThread(threadId, payload);
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

let wsServer: MessageWebSocketServer | null = null;

export function initializeWebSocket(
  server: HTTPServer, 
  sessionParser: RequestHandler, 
  sessionSecret: string
): MessageWebSocketServer {
  if (!wsServer) {
    wsServer = new MessageWebSocketServer(server, sessionParser, sessionSecret);
  }
  return wsServer;
}

export function getWebSocketServer(): MessageWebSocketServer | null {
  return wsServer;
}
