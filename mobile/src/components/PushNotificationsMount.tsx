import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { initPushNotifications } from "../lib/push-init";

/**
 * Invisible component. Lives inside the signed-in part of the tree (under
 * Gate + HashRouter) so it has both the JWT and a working `navigate` from
 * react-router. On mount + every time the JWT changes, it kicks off push
 * registration. The actual init is idempotent — it only does work the
 * first time per app session.
 */
export default function PushNotificationsMount() {
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    void initPushNotifications(token, (path) => navigate(path));
  }, [token, navigate]);

  return null;
}
