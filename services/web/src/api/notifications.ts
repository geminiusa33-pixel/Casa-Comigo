import { apiRequest } from "./http";
import type { Session } from "@supabase/supabase-js";

export type AppNotification = {
  id: string;
  type: "new_message" | "new_match" | "group_join_request" | "group_join_decision";
  title: string;
  body: string;
  resourceType: "match" | "group";
  resourceId: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationList = {
  items: AppNotification[];
  unreadCount: number;
};

export function getNotifications(session: Session, signal?: AbortSignal) {
  return apiRequest<NotificationList>("/api/notifications", session.access_token, { signal });
}

export function markNotificationRead(session: Session, notificationId: string) {
  return apiRequest<void>(`/api/notifications/${notificationId}/read`, session.access_token, { method: "PUT" });
}

export function markAllNotificationsRead(session: Session) {
  return apiRequest<void>("/api/notifications/read-all", session.access_token, { method: "PUT" });
}
