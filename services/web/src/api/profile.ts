export type SearchArea = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  areaLabel: string;
  locationSource: "gps" | "manual";
  updatedAt: string;
};

export type Profile = {
  id: string;
  displayName: string;
  bio: string;
  preferredHousemates: number | null;
  genderPreference: string;
  hasPets: boolean;
  interests: string[];
  opinions: string;
  workSchedule: string;
  cookingHabits: string;
  discoveryVisible: boolean;
  profileComplete: boolean;
  searchArea: SearchArea | null;
  updatedAt: string;
};

export type DiscoveryProfile = Omit<Profile, "id" | "discoveryVisible" | "profileComplete" | "searchArea" | "updatedAt"> & {
  id: string;
  areaLabel: string;
};

export type Match = {
  id: string;
  profileId: string;
  displayName: string;
  bio: string;
  preferredHousemates: number | null;
  hasPets: boolean;
  interests: string[];
  areaLabel: string;
  matchedAt: string;
};

export type ChatMessage = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  sentAt: string;
};
