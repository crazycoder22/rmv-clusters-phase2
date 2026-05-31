// Mounts the Universal Links / deep-link listener once, inside the
// authenticated router context so navigate() is available.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { initDeepLinks } from "../lib/deep-links";

export default function DeepLinksMount() {
  const navigate = useNavigate();
  useEffect(() => {
    initDeepLinks(navigate);
  }, [navigate]);
  return null;
}
