import { sha256 } from '../utils/hash';
import { cosineSimilarity } from '../embeddings/provider';
import { V2_CONFIG } from '../config';

export interface ClusterCandidate {
  articleId: string;
  embedding: number[];
  publishedAt?: Date;
}

export interface ClusterResult {
  clusterId: string;
  clusterKey: string;
  members: Array<{
    articleId: string;
    similarity: number;
  }>;
  representativeId: string;
}

export function clusterArticles(
  candidates: ClusterCandidate[],
  threshold: number = V2_CONFIG.dedupe.similarityThreshold
): ClusterResult[] {
  if (candidates.length === 0) return [];
  
  const clusters: ClusterResult[] = [];
  const assigned = new Set<string>();
  
  const sorted = [...candidates].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
  
  for (const candidate of sorted) {
    if (assigned.has(candidate.articleId)) continue;
    
    const clusterMembers: Array<{ articleId: string; similarity: number }> = [];
    
    for (const other of sorted) {
      if (assigned.has(other.articleId) || other.articleId === candidate.articleId) continue;
      
      const similarity = cosineSimilarity(candidate.embedding, other.embedding);
      if (similarity >= threshold) {
        clusterMembers.push({
          articleId: other.articleId,
          similarity,
        });
        assigned.add(other.articleId);
      }
    }
    
    if (clusterMembers.length > 0) {
      clusterMembers.unshift({
        articleId: candidate.articleId,
        similarity: 1.0,
      });
      assigned.add(candidate.articleId);
      
      const clusterKey = generateClusterKey(clusterMembers.map(m => m.articleId));
      
      clusters.push({
        clusterId: sha256(clusterKey).slice(0, 16),
        clusterKey,
        members: clusterMembers,
        representativeId: candidate.articleId,
      });
    }
  }
  
  return clusters;
}

function generateClusterKey(articleIds: string[]): string {
  return [...articleIds].sort().join('|');
}

export function mergeOverlappingClusters(clusters: ClusterResult[]): ClusterResult[] {
  if (clusters.length < 2) return clusters;
  
  const merged: ClusterResult[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;
    
    const current = clusters[i];
    const currentIds = new Set(current.members.map(m => m.articleId));
    
    const toMerge: ClusterResult[] = [current];
    used.add(i);
    
    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;
      
      const other = clusters[j];
      const overlap = other.members.some(m => currentIds.has(m.articleId));
      
      if (overlap) {
        toMerge.push(other);
        used.add(j);
        other.members.forEach(m => currentIds.add(m.articleId));
      }
    }
    
    if (toMerge.length === 1) {
      merged.push(current);
    } else {
      const allMembers = new Map<string, number>();
      for (const cluster of toMerge) {
        for (const member of cluster.members) {
          const existing = allMembers.get(member.articleId) || 0;
          allMembers.set(member.articleId, Math.max(existing, member.similarity));
        }
      }
      
      const mergedMembers = Array.from(allMembers.entries())
        .map(([articleId, similarity]) => ({ articleId, similarity }))
        .sort((a, b) => b.similarity - a.similarity);
      
      const clusterKey = generateClusterKey(mergedMembers.map(m => m.articleId));
      
      merged.push({
        clusterId: sha256(clusterKey).slice(0, 16),
        clusterKey,
        members: mergedMembers,
        representativeId: mergedMembers[0].articleId,
      });
    }
  }
  
  return merged;
}
