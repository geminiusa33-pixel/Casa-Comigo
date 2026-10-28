import type { DiscoveryProfile } from "./profile";

export type HousingGroupProfile = Pick<
  DiscoveryProfile,
  | "bio"
  | "preferredHousemates"
  | "genderPreference"
  | "hasPets"
  | "interests"
  | "opinions"
  | "workSchedule"
  | "cookingHabits"
  | "rentContributionRange"
  | "leaseHolderPreference"
  | "billsPreference"
  | "furnishedPreference"
  | "preferredBathrooms"
  | "preferredBedrooms"
  | "homeTypePreference"
  | "moveInTiming"
  | "minimumLeaseMonths"
>;

export type HousingGroupMember = {
  profileId: string;
  displayName: string;
  photoPath: string | null;
  areaLabel: string;
  rentContributionRange: string | null;
  confirmedCompletion: boolean;
  profile: HousingGroupProfile;
};

export type HousingGroupJoinRequest = {
  id: string;
  requesterId: string;
  displayName: string;
  photoPath: string | null;
  areaLabel: string;
  rentContributionRange: string | null;
  approvalCount: number;
  requiredApprovals: number;
  myVote: boolean | null;
  createdAt: string;
  profile: HousingGroupProfile;
};

export type HousingGroup = {
  id: string;
  originMatchId: string | null;
  name: string;
  targetOccupants: number;
  memberCount: number;
  totalMonthlyRentMinimum: number | null;
  totalMonthlyRentMaximum: number | null;
  completionConfirmations: number;
  status: "open" | "completed";
  createdAt: string;
  myJoinRequestStatus: "pending" | "accepted" | "declined" | null;
  members: HousingGroupMember[];
  pendingRequests: HousingGroupJoinRequest[];
};

export type HousingGroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  sentAt: string;
};
