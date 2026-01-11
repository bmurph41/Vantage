import { apiRequest } from "./queryClient";
import type { MarinaLocation, InsertMarinaLocation } from "@shared/schema";

export async function getAllLocations(): Promise<MarinaLocation[]> {
  const res = await apiRequest("GET", "/api/rent-roll/locations");
  return await res.json();
}

export async function getActiveLocations(): Promise<MarinaLocation[]> {
  const res = await apiRequest("GET", "/api/rent-roll/locations/active");
  return await res.json();
}

export async function getLocationById(id: string): Promise<MarinaLocation> {
  const res = await apiRequest("GET", `/api/rent-roll/locations/${id}`);
  return await res.json();
}

export async function createLocation(data: InsertMarinaLocation): Promise<MarinaLocation> {
  const res = await apiRequest("POST", "/api/rent-roll/locations", data);
  return await res.json();
}

export async function updateLocation(id: string, data: Partial<InsertMarinaLocation>): Promise<MarinaLocation> {
  const res = await apiRequest("PUT", `/api/rent-roll/locations/${id}`, data);
  return await res.json();
}

export async function deleteLocation(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/rent-roll/locations/${id}`);
}

export interface LocationOccupancy {
  locationId: string;
  locationName: string;
  capacity: number | null;
  activeLeases: number;
  occupancyRate: number;
  totalRevenue: string;
}

export async function getLocationOccupancy(
  startDate: string,
  endDate: string
): Promise<LocationOccupancy[]> {
  const url = `/api/rent-roll/location-occupancy?startDate=${startDate}&endDate=${endDate}`;
  const res = await apiRequest("GET", url);
  return await res.json();
}
