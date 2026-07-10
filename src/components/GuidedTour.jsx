import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Joyride, EVENTS, STATUS } from 'react-joyride';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './GuidedTour.css';

const START_DELAY_MS = 700;
const TARGET_RETRY_MS = 250;
const MAX_TARGET_RETRIES = 20;
const GUIDED_TOUR_ENABLED = true;

function getCreatedAtMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
  if (typeof createdAt === 'number') return createdAt;
  return 0;
}

function isElementAvailable(target) {
  if (typeof document === 'undefined' || !target) return false;

  if (typeof target !== 'string') {
    return document.contains(target);
  }

  try {
    const element = document.querySelector(target);
    return Boolean(element && element.getClientRects().length > 0);
  } catch {
    return false;
  }
}

function getAvailableSteps(steps) {
  return steps.filter((step) => isElementAvailable(step.target));
}

function PremiumTourTooltip({
  backProps,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  size,
  step,
  tooltipProps,
}) {
  const progressItems = Array.from({ length: size });

  return (
    <div className="guided-tour-card" {...tooltipProps}>
      <button {...skipProps} type="button" className="guided-tour-close" aria-label="Skip tour">
        <X size={16} />
      </button>

      <div className="guided-tour-topline">
        <span className="guided-tour-badge">
          <Sparkles size={14} />
          Guided setup
        </span>
        <span className="guided-tour-count">{index + 1}/{size}</span>
      </div>

      <div className="guided-tour-heading">
        <span className="guided-tour-pulse" aria-hidden="true" />
        <h3>{step.title || 'Quick guide'}</h3>
      </div>

      <div className="guided-tour-content">{step.content}</div>

      <div className="guided-tour-progress" aria-hidden="true">
        {progressItems.map((_, itemIndex) => (
          <span
            key={itemIndex}
            className={itemIndex <= index ? 'active' : ''}
          />
        ))}
      </div>

      <div className="guided-tour-footer">
        <button {...skipProps} type="button" className="guided-tour-skip">
          Skip
        </button>

        <div className="guided-tour-actions">
          {index > 0 && (
            <button {...backProps} type="button" className="guided-tour-back">
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <button {...primaryProps} type="button" className="guided-tour-next">
            {isLastStep ? 'Finish' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function GuidedTourImpl({ user, steps = [], tourKey, disabled = false }) {
  const [activeSteps, setActiveSteps] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [run, setRun] = useState(false);
  const persistingRef = useRef(false);

  const userTourValue = user?.[tourKey];
  const createdAtMillis = useMemo(() => getCreatedAtMillis(user?.createdAt), [user?.createdAt]);
  const storageKey = useMemo(() => {
    if (!user?.uid || !tourKey) return '';
    return `speak2them:guided-tour:${user.uid}:${tourKey}`;
  }, [tourKey, user?.uid]);

  const rememberLocalCompletion = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Local storage can be unavailable in private webviews.
    }
  }, [storageKey]);

  const hasLocalCompletion = useCallback(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  }, [storageKey]);

  const persistCompletion = useCallback(async () => {
    if (!user?.uid || !tourKey || persistingRef.current) return;

    persistingRef.current = true;
    rememberLocalCompletion();

    try {
      await setDoc(doc(db, 'users', user.uid), { [tourKey]: true }, { merge: true });
    } catch (error) {
      console.error(`[GuidedTour] Failed to save ${tourKey}`, error);
    } finally {
      persistingRef.current = false;
    }
  }, [rememberLocalCompletion, tourKey, user?.uid]);

  const finishTour = useCallback(() => {
    setRun(false);
    setDismissed(true);
    setActiveSteps([]);
    void persistCompletion();
  }, [persistCompletion]);

  useEffect(() => {
    setRun(false);
    setActiveSteps([]);
    setDismissed(false);
  }, [tourKey, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !tourKey) return;

    if (userTourValue === true) {
      rememberLocalCompletion();
      setRun(false);
      setDismissed(true);
    }
  }, [rememberLocalCompletion, tourKey, user?.uid, userTourValue]);

  useEffect(() => {
    if (!user?.uid || !tourKey || dismissed || disabled || !steps.length) {
      setRun(false);
      return undefined;
    }

    const forcedReplay = userTourValue === false;
    const completedRemotely = userTourValue === true;

    if (completedRemotely) {
      setDismissed(true);
      setRun(false);
      return undefined;
    }

    if (!forcedReplay && hasLocalCompletion()) {
      setDismissed(true);
      setRun(false);
      void persistCompletion();
      return undefined;
    }

    const isNewUser = createdAtMillis > 0
      ? Date.now() - createdAtMillis < 7 * 24 * 60 * 60 * 1000
      : false;
    const shouldStart = forcedReplay || (isNewUser && userTourValue === undefined);

    if (!shouldStart) {
      setRun(false);
      return undefined;
    }

    let cancelled = false;
    let retries = 0;
    let timerId;

    const tryStart = () => {
      if (cancelled) return;

      const visibleSteps = getAvailableSteps(steps);

      if (visibleSteps.length > 0) {
        setActiveSteps(visibleSteps);
        setRun(true);
        return;
      }

      if (retries < MAX_TARGET_RETRIES) {
        retries += 1;
        timerId = window.setTimeout(tryStart, TARGET_RETRY_MS);
      }
    };

    timerId = window.setTimeout(tryStart, START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    disabled,
    dismissed,
    hasLocalCompletion,
    persistCompletion,
    steps,
    tourKey,
    createdAtMillis,
    user?.uid,
    userTourValue,
  ]);

  const handleTourEvent = useCallback((data) => {
    const finished = data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED;
    const ended = data.type === EVENTS.TOUR_END;

    if (finished || ended) {
      finishTour();
    }
  }, [finishTour]);

  if (!activeSteps.length && !run) return null;

  return (
    <Joyride
      continuous
      onEvent={handleTourEvent}
      run={run}
      scrollToFirstStep
      steps={activeSteps}
      tooltipComponent={PremiumTourTooltip}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        nextWithProgress: 'Next',
        skip: 'Skip',
      }}
      options={{
        arrowColor: '#141421',
        backgroundColor: '#141421',
        buttons: ['skip', 'back', 'primary'],
        closeButtonAction: 'skip',
        dismissKeyAction: false,
        disableFocusTrap: false,
        offset: 12,
        overlayClickAction: false,
        overlayColor: 'rgba(4, 6, 14, 0.78)',
        primaryColor: '#7c6ff7',
        scrollDuration: 360,
        scrollOffset: 96,
        showProgress: true,
        skipBeacon: true,
        spotlightPadding: 10,
        spotlightRadius: 18,
        targetWaitTimeout: 1200,
        textColor: '#f8fafc',
        width: 'min(360px, calc(100vw - 32px))',
        zIndex: 12000,
      }}
      styles={{
        beaconInner: {
          backgroundColor: '#22d3ee',
        },
        beaconOuter: {
          borderColor: '#22d3ee',
        },
        floater: {
          filter: 'drop-shadow(0 24px 50px rgba(0, 0, 0, 0.45))',
        },
        overlay: {
          backdropFilter: 'blur(5px)',
        },
        spotlight: {
          stroke: 'rgba(34, 211, 238, 0.72)',
          strokeWidth: 2,
        },
      }}
    />
  );
}

export default function GuidedTour(props) {
  if (!GUIDED_TOUR_ENABLED) return null;
  return <GuidedTourImpl {...props} />;
}
