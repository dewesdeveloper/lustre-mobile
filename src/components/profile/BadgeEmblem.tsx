import { themedStyles } from '@/theme/themedStyles';
import { ComponentType } from 'react';
import { Text, View } from 'react-native';
import {
  Award,
  BookOpen,
  Camera,
  Clapperboard,
  Crown,
  Eye,
  Flag,
  Gem,
  Library,
  Megaphone,
  Medal,
  MessageCircle,
  Rocket,
  ShoppingCart,
  Sparkles,
  Star,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react-native';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Эксклюзивные эмблемы лаунчера по коду значка (lucide)
const ICONS: Record<string, IconCmp> = {
  first_steps: Rocket,
  collector: BookOpen,
  librarian: Library,
  social: Users,
  chatterbox: MessageCircle,
  patron: ShoppingCart,
  stylist: Sparkles,
  magnate: Gem,
  reviewer: Star,
  critic: Clapperboard,
  adult_explorer: Eye,
  founder: Flag,
  team_player: UsersRound,
  activist: Megaphone,
  photographer: Camera,
  season_bronze: Medal,
  season_silver: Award,
  season_gold: Trophy,
  season_legend: Crown,
};

const RARITY: Record<string, { ring: string; glow: string; color: string }> = {
  common: { ring: 'rgba(255,255,255,0.25)', glow: 'rgba(255,255,255,0.12)', color: '#cbd5e1' },
  rare: { ring: 'rgba(34,211,238,0.55)', glow: 'rgba(34,211,238,0.4)', color: '#67e8f9' },
  epic: { ring: 'rgba(139,92,246,0.6)', glow: 'rgba(139,92,246,0.45)', color: '#c4b5fd' },
  legendary: { ring: 'rgba(250,204,21,0.65)', glow: 'rgba(250,204,21,0.5)', color: '#fde68a' },
};

interface Props {
  code?: string;
  rarity?: string;
  size?: number;
  dim?: boolean;
}

/** Графическая эмблема значка (щит/медаль) с цветом редкости. */
export default function BadgeEmblem({ code = '', rarity = 'common', size = 48, dim = false }: Props) {
  const r = RARITY[rarity] || RARITY.common;
  const isAnniversary = code.startsWith('anniversary_');
  const year = isAnniversary ? code.split('_')[1] || '' : '';
  const Icon = ICONS[code] || Award;
  const pad = Math.max(2, Math.round(size * 0.05));

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: pad,
          borderColor: r.ring,
          opacity: dim ? 0.45 : 1,
          shadowColor: r.glow,
        },
      ]}>
      <View
        style={[
          styles.core,
          { borderRadius: size / 2 - pad, backgroundColor: '#0b0b0f' },
        ]}>
        {isAnniversary ? (
          <Text
            style={{
              color: r.color,
              fontSize: Math.round(size * 0.4),
              fontWeight: '900',
              fontStyle: 'italic',
            }}>
            {year}
          </Text>
        ) : (
          <Icon size={Math.round(size * 0.46)} color={r.color} strokeWidth={2.2} />
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
