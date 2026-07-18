import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLibraryStore } from '../store/useLibraryStore';

export function LaunchOverlay() {
  const launchState = useLibraryStore((state) => state.launchState);
  const clearLaunchState = useLibraryStore((state) => state.clearLaunchState);

  return (
    <AnimatePresence>
      {launchState.kind !== 'idle' && (
        <motion.div className="launch-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="launch-overlay__content" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {launchState.kind === 'error' ? <AlertTriangle size={28} /> : <LoaderCircle className="launch-overlay__spinner" size={28} />}
            <p>{launchState.kind === 'error' ? 'Could not start game' : 'Launching'}</p>
            <strong>{launchState.game.name}</strong>
            {launchState.kind === 'error' && <button type="button" onClick={clearLaunchState}>Return to library</button>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
