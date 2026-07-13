import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { weeklyContent } from '../data/weeklyContent';
import { setCycleState } from './cycleCache';

// The 28-topic cycle. Topic index and progress both come from the server doc
// appConfig/cycle (written by the advanceCycle scheduled function); this file
// subscribes and keeps the shared cache warm.
export const TOPIC_COUNT = weeklyContent.length;

// Real-time subscription to appConfig/cycle. Updates the shared cache (so
// getTodayIndex() reflects the server value) and forwards the raw doc to `cb`
// for any view that needs cycleTick (e.g. the progress indicator).
export function subscribeToCycle(cb) {
  return onSnapshot(
    doc(db, 'appConfig', 'cycle'),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setCycleState(data);
      if (cb) cb(data);
    },
    () => { if (cb) cb(null); }
  );
}
