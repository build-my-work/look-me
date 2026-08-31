import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import i18n from "./i18n";

const MAX_COUNTDOWN_SECONDS = 5;

function getInitialSeconds(): number {
  const requested = Number(
    new URLSearchParams(window.location.search).get("seconds"),
  );
  return Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= MAX_COUNTDOWN_SECONDS
    ? requested
    : MAX_COUNTDOWN_SECONDS;
}

export function LockCountdownOverlay() {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(getInitialSeconds);

  useEffect(() => {
    return window.lookMe?.onLockCountdown((nextSeconds) => {
      if (nextSeconds !== null) {
        setSeconds(nextSeconds);
      }
    });
  }, []);

  useEffect(() => {
    return window.lookMe?.onLocaleChanged(({ locale }) => {
      void i18n.changeLanguage(locale);
    });
  }, []);

  return (
    <main
      className="lock-overlay"
      data-seconds={seconds}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="lock-overlay__circle" aria-hidden>
        <CircularProgressbar
          value={seconds}
          maxValue={MAX_COUNTDOWN_SECONDS}
          strokeWidth={4.5}
          styles={buildStyles({
            pathColor: "rgba(235, 255, 250, 0.94)",
            trailColor: "rgba(235, 255, 250, 0.18)",
            pathTransition: "stroke-dashoffset 720ms linear",
          })}
        />
        <span className="lock-overlay__number" key={seconds}>
          {seconds}
        </span>
      </div>
      <div className="lock-overlay__copy">
        <strong>{t("lockOverlay.title")}</strong>
        <span>{t("lockOverlay.message")}</span>
      </div>
    </main>
  );
}
