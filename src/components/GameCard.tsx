import { Play, PlaySquare } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Game } from '../types/game';

interface GameCardProps {
  game: Game;
  selected: boolean;
  isRunning?: boolean;
  onSelect: () => void;
  onLaunch: () => void;
  onResume?: () => void;
}

export function GameCard({ game, selected, isRunning, onSelect, onLaunch, onResume }: GameCardProps) {
  return (
    <article
      className={`game-card${selected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}`}
      style={{ '--game-accent': game.accent } as CSSProperties}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div className="game-card__art" aria-hidden="true">
        <span className="game-card__monogram">{game.name.slice(0, 1)}</span>
      </div>
      <div className="game-card__body">
        <h2>{game.name}</h2>
        {isRunning ? (
          <button className="play-button" type="button" onClick={onResume} aria-label={`Resume ${game.name}`}>
            <PlaySquare size={17} fill="currentColor" aria-hidden="true" />
            <span>Resume</span>
          </button>
        ) : (
          <button className="play-button" type="button" onClick={onLaunch} aria-label={`Play ${game.name}`}>
            <Play size={17} fill="currentColor" aria-hidden="true" />
            <span>Play</span>
          </button>
        )}
      </div>
    </article>
  );
}
