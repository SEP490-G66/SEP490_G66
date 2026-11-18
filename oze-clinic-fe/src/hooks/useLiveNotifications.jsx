import { useEffect, useEffectEvent } from "react";
import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { toNotification } from "@/services/notificationService";
import { getSessionToken } from "@/services/sessionStore";

export const LIVE_NOTIFICATION_EVENT = "oze:notification";

const HUB_PATH = "/hubs/notifications";
const HUB_EVENT = "notification";
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 30000];
const FALLBACK_INTERVAL_MS = 30_000;
const RESTART_DELAY_MS = 5000;

const useLiveNotifications = ({ onNotification, onFallbackTick }) => {
    const receive = useEffectEvent(onNotification);
    const fallback = useEffectEvent(onFallbackTick);

    useEffect(() => {
        if (!getSessionToken()) return undefined;
        const connection = new HubConnectionBuilder()
            .withUrl(`${import.meta.env.VITE_API_URL}${HUB_PATH}`, { accessTokenFactory: () => getSessionToken() ?? "", withCredentials: false })
            .withAutomaticReconnect(RECONNECT_DELAYS_MS)
            .configureLogging(LogLevel.None)
            .build();
        let stopped = false;
        let restartTimer = null;

        const start = () => {
            if (stopped) return;
            connection.start().catch(() => {
                if (!stopped) restartTimer = setTimeout(start, RESTART_DELAY_MS);
            });
        };

        connection.on(HUB_EVENT, (item) => {
            const notification = toNotification(item);
            receive(notification);
            window.dispatchEvent(new CustomEvent(LIVE_NOTIFICATION_EVENT, { detail: notification }));
        });
        connection.onclose(() => {
            if (!stopped) restartTimer = setTimeout(start, RESTART_DELAY_MS);
        });
        start();

        const fallbackTimer = setInterval(() => {
            if (connection.state !== HubConnectionState.Connected) fallback();
        }, FALLBACK_INTERVAL_MS);

        return () => {
            stopped = true;
            clearTimeout(restartTimer);
            clearInterval(fallbackTimer);
            connection.stop();
        };
    }, []);
};

export default useLiveNotifications;
