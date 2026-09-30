"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";

// The Home Screen tip (PRD F12): iOS Safari only, from the third visit on,
// never once installed, and never again after it's dismissed. A visit is a
// browser session that opens My shelf.
const VISITS = "gw:visits";
const COUNTED = "gw:visit-counted";
const DISMISSED = "gw:home-tip-dismissed";

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function HomeScreenTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      let visits = Number(localStorage.getItem(VISITS) ?? "0");
      if (!sessionStorage.getItem(COUNTED)) {
        visits += 1;
        localStorage.setItem(VISITS, String(visits));
        sessionStorage.setItem(COUNTED, "1");
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(visits >= 3 && !localStorage.getItem(DISMISSED) && isIosSafari() && !isInstalled());
    } catch {
      // Storage unavailable: no tip.
    }
  }, []);

  if (!show) return null;
  return (
    <Banner>
      <div className="flex flex-col items-start gap-2">
        <span>{t("you.homeScreenTip")}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED, "1");
            } catch {
              // It just comes back next visit.
            }
            setShow(false);
          }}
        >
          {t("you.homeScreenDismiss")}
        </Button>
      </div>
    </Banner>
  );
}
