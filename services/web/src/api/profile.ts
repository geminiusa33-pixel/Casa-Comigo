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
  monthlyBudget: number | null;
  leaseHolderPreference: string;
  billsPreference: string;
  furnishedPreference: string;
  preferredBathrooms: number | null;
  preferredBedrooms: number | null;
  homeTypePreference: string;
  moveInTiming: string;
  minimumLeaseMonths: number | null;
  discoveryVisible: boolean;
  profileComplete: boolean;
  searchArea: SearchArea | null;
  photoPath: string | null;
  updatedAt: string;
};

export type DiscoveryProfile = Omit<Profile, "id" | "discoveryVisible" | "profileComplete" | "searchArea" | "updatedAt"> & {
  id: string;
  areaLabel: string;
  photoPath?: string | null;
};

export type Match = {
  id: string;
  profileId: string;
  displayName: string;
  bio: string;
  preferredHousemates: number | null;
  genderPreference?: string;
  hasPets: boolean;
  interests: string[];
  opinions?: string;
  workSchedule?: string;
  cookingHabits?: string;
  areaLabel: string;
  matchedAt: string;
  photoPath?: string | null;
  monthlyBudget?: number | null;
  leaseHolderPreference?: string;
  billsPreference?: string;
  furnishedPreference?: string;
  preferredBathrooms?: number | null;
  preferredBedrooms?: number | null;
  homeTypePreference?: string;
  moveInTiming?: string;
  minimumLeaseMonths?: number | null;
};

export type ChatMessage = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  sentAt: string;
};
