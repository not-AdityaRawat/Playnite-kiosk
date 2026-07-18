import { Play } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Game } from '../types/game';

interface GameCardProps {
  game: Game;
  selected: boolean;
  onSelect: () => void;
  onLaunch: () => void;
}

export function GameCard({ game, selected, onSelect, onLaunch }: GameCardProps) {
  return (
    <article
      className={`game-card${selected ? ' is-selected' : ''}`}
      style={{ '--game-accent': game.accent } as CSSProperties}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div className="game-card__art" aria-hidden="true">
        <span className="game-card__monogram">{game.name.slice(0, 1)}</span>
      </div>
      <div className="game-card__body">
        <h2>{game.name}</h2>
        <button className="play-button" type="button" onClick={onLaunch} aria-label={`Play ${game.name}`}>
          <Play size={17} fill="currentColor" aria-hidden="true" />
          <span>Play</span>
        </button>
      </div>
    </article>
  );
}
