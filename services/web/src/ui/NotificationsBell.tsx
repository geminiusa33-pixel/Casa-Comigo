import { useCallback, useEffect, useState } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import { Alert24Regular } from "@fluentui/react-icons";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationList,
} from "../api/notifications";

type Props = {
  session: Session;
  onUnreadCountChange: (count: number) => void;
  onOpenNotification: (notification: AppNotification) => void;
};

export function NotificationsBell({ session, onUnreadCountChange, onOpenNotification }: Props) {
  const [notifications, setNotifications] = useState<NotificationList>({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getNotifications(session, signal);
      setNotifications(result);
      onUnreadCountChange(result.unreadCount);
      setError("");
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [onUnreadCountChange, session]);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications(controller.signal);
    const intervalId = window.setInterval(() => void loadNotifications(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (!supported) return;

    let active = true;
    void navigator.serviceWorker.register("/sw.js")
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription || Notification.permission !== "granted") return;
        const keys = subscription.toJSON().keys;
        if (!keys?.p256dh || !keys.auth) return;
        await apiRequest<void>("/api/notifications/push-subscriptions", session.access_token, {
          method: "POST",
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          }),
        });
        if (active) setPushEnabled(true);
      })
      .catch((caught: unknown) => {
        console.error("Não foi possível preparar as notificações push do browser.", caught);
      });

    return () => { active = false; };
  }, [session.access_token]);

  async function openNotification(notification: AppNotification) {
    setOpen(false);
    if (notification.readAt === null) {
      try {
        await markNotificationRead(session, notification.id);
        await loadNotifications();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a notificação.");
      }
    }
    onOpenNotification(notification);
  }

  async function markAllRead() {
    setWorking(true);
    setError("");
    try {
      await markAllNotificationsRead(session);
      await loadNotifications();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar as notificações.");
    } finally {
      setWorking(false);
    }
  }

  async function togglePush() {
    setWorking(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing && pushEnabled) {
        await apiRequest<void>("/api/notifications/push-subscriptions", session.access_token, {
          method: "DELETE",
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPushEnabled(false);
        return;
      }

      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        setError("Permita as notificações nas definições do browser para as ativar.");
        return;
      }

      const { publicKey } = await apiRequest<{ publicKey: string }>(
        "/api/notifications/push/vapid-public-key",
        session.access_token,
      );
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) throw new Error("O browser não devolveu as chaves da subscrição push.");

      await apiRequest<void>("/api/notifications/push-subscriptions", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });
      setPushEnabled(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível configurar as notificações push.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="notifications-anchor">
      <Button
        className="notifications-bell"
        appearance="subtle"
        icon={<Alert24Regular />}
        aria-label={`Notificações${notifications.unreadCount ? `, ${notifications.unreadCount} por ler` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {notifications.unreadCount > 0 && (
        <span className="notifications-count" aria-hidden="true">
          {notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}
        </span>
      )}
      {open && (
        <section className="notifications-popover" aria-label="Notificações">
          <header>
            <div>
              <strong>Notificações</strong>
              <small>{notifications.unreadCount} por ler</small>
            </div>
            <Button appearance="subtle" size="small" disabled={!notifications.unreadCount || working} onClick={() => void markAllRead()}>
              Marcar tudo como lido
            </Button>
          </header>
          {error && <p className="notifications-error" role="alert">{error}</p>}
          {loading
            ? <Spinner size="small" label="A carregar notificações…" />
            : notifications.items.length
              ? <div className="notifications-list">
                  {notifications.items.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`notification-item${notification.readAt ? "" : " is-unread"}`}
                      onClick={() => void openNotification(notification)}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <time dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
                    </button>
                  ))}
                </div>
              : <p className="notifications-empty">Ainda não tem notificações.</p>}
          {pushSupported && (
            <footer>
              <Button appearance="secondary" size="small" disabled={working} onClick={() => void togglePush()}>
                {working
                  ? "A atualizar…"
                  : pushEnabled
                    ? "Desativar notificações do browser"
                    : "Ativar notificações do browser"}
              </Button>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}

function decodeVapidKey(key: string) {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
