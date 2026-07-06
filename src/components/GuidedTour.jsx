import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function GuidedTour({ user, steps, tourKey }) {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user || !user.uid) return;

    // A user is considered new if created within the last 7 days
    const createdAtMillis = user.createdAt?.toMillis?.() || 0;
    const isNewUser = createdAtMillis > 0 ? (Date.now() - createdAtMillis < 7 * 24 * 60 * 60 * 1000) : false;
    
    // Explicitly requested tour run
    if (user[tourKey] === false) {
      setRun(true);
    } 
    // Or it's a new user and they haven't done it yet (undefined)
    else if (isNewUser && user[tourKey] === undefined) {
      // Delay slightly to ensure UI is fully rendered
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, tourKey, mounted]);

  const handleJoyrideCallback = async (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      
      // Prevent running again by updating Firebase
      if (user && user.uid) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            [tourKey]: true
          });
        } catch (e) {
          console.error("Failed to update tour status", e);
        }
      }
    }
  };

  if (!mounted) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      disableOverlayClose
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: {
            filter: 'drop-shadow(0 8px 24px rgba(124, 111, 247, 0.4))'
          }
        }
      }}
      styles={{
        options: {
          arrowColor: '#2a2a40',
          backgroundColor: '#1e1e30',
          overlayColor: 'rgba(15, 15, 23, 0.85)',
          primaryColor: '#7c6ff7',
          textColor: '#ffffff',
          width: 380,
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: 'left',
          fontSize: '15px',
          lineHeight: '1.6',
          padding: '10px 0'
        },
        tooltipTitle: {
          color: '#a855f7',
          fontWeight: 800,
          fontSize: '18px',
          margin: '0 0 10px 0'
        },
        buttonNext: {
          backgroundColor: '#7c6ff7',
          borderRadius: '10px',
          fontWeight: 700,
          padding: '10px 20px',
          boxShadow: '0 4px 12px rgba(124, 111, 247, 0.3)'
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: '10px',
          fontWeight: 600
        },
        buttonSkip: {
          color: '#ef4444',
          fontWeight: 600,
          fontSize: '14px'
        }
      }}
      locale={{
        back: 'Geri',
        close: 'Bağla',
        last: 'Bitir',
        next: 'İrəli',
        skip: 'Turu Keç'
      }}
    />
  );
}
