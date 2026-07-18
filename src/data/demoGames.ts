import type { Game } from '../types/game';

export const demoGames: Game[] = [
  { id: '1', name: 'Grand Theft Auto V', launchMethod: 'steam_uri', executable: 'steam://rungameid/271590', accent: '#d85b40', sortOrder: 1, visible: true },
  { id: '2', name: 'Cyberpunk 2077', launchMethod: 'steam_uri', executable: 'steam://rungameid/1091500', accent: '#dfca35', sortOrder: 2, visible: true },
  { id: '3', name: 'Battlefield 6', launchMethod: 'ea_uri', executable: 'ea://launch/placeholder', accent: '#5b9f9a', sortOrder: 3, visible: true },
  { id: '4', name: 'Red Dead Redemption 2', launchMethod: 'steam_uri', executable: 'steam://rungameid/1174180', accent: '#a6603b', sortOrder: 4, visible: true },
  { id: '5', name: 'Elden Ring', launchMethod: 'steam_uri', executable: 'steam://rungameid/1245620', accent: '#637f99', sortOrder: 5, visible: true },
  { id: '6', name: 'Forza Horizon 5', launchMethod: 'steam_uri', executable: 'steam://rungameid/1551360', accent: '#b57d36', sortOrder: 6, visible: true },
];
