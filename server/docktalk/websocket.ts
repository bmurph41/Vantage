import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import type { Article } from "@shared/docktalk-schema";

let wss: WebSocketServer | null = null;

export function initializeWebSocket(httpServer: Server) {
  wss = new WebSocketServer({ 
    server: httpServer, 
    path: process.env.WS_PATH || "/ws" 
  });

  wss.on("connection", (ws: WebSocket) => {
    
    ws.on("close", () => {
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

}

export function broadcastNewArticle(article: Partial<Article>) {
  if (!wss) {
    return;
  }
  
  const message = JSON.stringify({
    type: "new_article",
    payload: {
      id: article.id,
      title: article.title,
      url: article.url,
      source: article.source,
      category: article.category,
      publishedAt: article.publishedAt,
      relevanceScore: article.relevanceScore,
    },
    timestamp: Date.now(),
  });

  let clientCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      clientCount++;
    }
  });
}

export function broadcastFetchStatus(status: { 
  type: 'fetch_started' | 'fetch_completed' | 'fetch_error'; 
  newArticles?: number;
  error?: string;
  timestamp: number;
  nextFetch?: string;
}) {
  if (!wss) {
    return;
  }
  
  const message = JSON.stringify({
    type: "fetch_status",
    payload: status,
    timestamp: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
