// Ícones do lucide usados no site, reunidos aqui pra ficar fácil ver o que
// está em uso e trocar sem caçar import solto pelos componentes.
// Uso: importe LucideAngularModule no componente e faça <lucide-icon [img]="Icons.dps" />
import {
  ChevronDown,
  Clock3,
  Crosshair,
  Crown,
  ExternalLink,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  Medal,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sword,
  Swords,
  Target,
  TriangleAlert,
  Trophy,
  X,
  Zap,
} from 'lucide-angular';

export const Icons = {
  // roles
  dps: Swords,
  tank: Shield,
  healer: HeartPulse,
  support: Sparkles,

  // estilo de jogo
  melee: Sword,
  ranged: Crosshair,
  caster: Zap,

  // interface
  advanced: SlidersHorizontal,
  chevron: ChevronDown,
  reset: RotateCcw,
  clock: Clock3,
  metric: Gauge,
  target: Target,
  info: Info,

  // avisos nos cards de spec
  lowSample: TriangleAlert,
  highVariance: Flame,

  // rankings
  ranking: Trophy,
  first: Crown,
  medal: Medal,
  external: ExternalLink,
  search: Search,
  clear: X,
} as const;
