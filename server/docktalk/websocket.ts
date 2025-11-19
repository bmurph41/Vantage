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
    console.log("WebSocket client connected");
    
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized");
}

export function broadcastNewArticle(article: Partial<Article>) {
  if (!wss) {
    console.warn("WebSocket server not initialized, cannot broadcast");
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

  if (clientCount > 0) {
    console.log(`Broadcasted new article to ${clientCount} client(s): ${article.title}`);
  }
}
