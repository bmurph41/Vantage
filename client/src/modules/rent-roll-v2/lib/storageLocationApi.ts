import type { StorageLocation, InsertStorageLocation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export async function getStorageLocationsByProject(projectId: string): Promise<StorageLocation[]> {
  const response = await fetch(`/api/rent-roll/storage-locations?projectId=${projectId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch storage locations");
  }
  return response.json();
}

export async function getStorageLocationById(id: string): Promise<StorageLocation> {
  const response = await fetch(`/api/rent-roll/storage-locations/${id}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch storage location");
  }
  return response.json();
}

export async function createStorageLocation(data: InsertStorageLocation): Promise<StorageLocation> {
  const response = await apiRequest("POST", "/api/rent-roll/storage-locations", data);
  return response.json();
}

export async function updateStorageLocation(
  id: string,
  data: Partial<InsertStorageLocation>
): Promise<StorageLocation> {
  const response = await apiRequest("PUT", `/api/rent-roll/storage-locations/${id}`, data);
  return response.json();
}

export async function deleteStorageLocation(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/rent-roll/storage-locations/${id}`);
}
