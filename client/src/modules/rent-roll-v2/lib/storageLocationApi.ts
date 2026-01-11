import type { StorageLocation, InsertStorageLocation } from "@shared/schema";

export async function getStorageLocationsByProject(projectId: string): Promise<StorageLocation[]> {
  const response = await fetch(`/api/rent-roll/storage-locations?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch storage locations");
  }
  return response.json();
}

export async function getStorageLocationById(id: string): Promise<StorageLocation> {
  const response = await fetch(`/api/rent-roll/storage-locations/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch storage location");
  }
  return response.json();
}

export async function createStorageLocation(data: InsertStorageLocation): Promise<StorageLocation> {
  const response = await fetch("/api/rent-roll/storage-locations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create storage location");
  }
  return response.json();
}

export async function updateStorageLocation(
  id: string,
  data: Partial<InsertStorageLocation>
): Promise<StorageLocation> {
  const response = await fetch(`/api/rent-roll/storage-locations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update storage location");
  }
  return response.json();
}

export async function deleteStorageLocation(id: string): Promise<void> {
  const response = await fetch(`/api/rent-roll/storage-locations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete storage location");
  }
}
