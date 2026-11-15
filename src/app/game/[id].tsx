import { themedStyles } from '@/theme/themedStyles';
import { openExternalUrl } from '@/utils/openUrl';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,

  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Disc,
  ExternalLink,
  Gamepad2,
  Heart,
  Info,
  Languages,
  Meh,
  Monitor,
  MonitorDown,
  Play,
  Shield,
  Star,
  Tags as TagsIcon,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import api from '@/api/client';
import { deleteReview, getGameReviews, type GameReview } from '@/api/reviews';
import ReviewComposer from '@/components/game/ReviewComposer';
import RemoteInstallPanel from '@/components/game/RemoteInstallPanel';
import { useAuth } from '@/context/AuthContext';
import { canModerate } from '@/utils/roles';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const CYAN = '#22d3ee';
const YELLOW = '#facc15';

interface GameMedia {
  id: number;
  url: string;
  is_video: boolean;
  thumbnail?: string;
}

interface Requirement {
  id: number;
  type: string;
  os: string;
  processor: string;
  graphics_card: string;
  ram: string;
  storage: string;
}

interface GameLanguage {
  id: number;
  name: string;
  interface: boolean;
  audio: boolean;
  subtitles: boolean;
}

interface Tag {
  id: number;
  name: string;
}

interface GameSource {
  id: number;
  kind: string;
  label: string;
  magnet_uri: string;
  url: string;
  size: string;
}

interface GameStoreLink {
  id: number;
  store: string;
  url: string;
}

interface GameDto {
  ID: number;
  title: string;
  developer: string;
  publisher: string;
  release_date: string | null;
  description: string;
  about_game: string;
  banner_url: string;
  header_image: string;
  age_rating: string;
  magnet_uri: string;
  is_adult: boolean;
  media: GameMedia[];
  requirements: Requirement[];
  languages: GameLanguage[];
  sources: GameSource[];
  store_links: GameStoreLink[];
  tags: Tag[];
  features: unknown;
}

const STORE_LABEL: Record<string, string> = {
  steam: 'Steam',
  itch: 'itch.io',
  gamejolt: 'GameJolt',
};

const KIND_LABEL: Record<string, string> = {
  torrent: 'Торрент',
  direct: 'Прямая ссылка',
  pixeldrain: 'Pixeldrain',
};

const MODE_LABELS: Record<string, string> = {
  singlePlayer: 'Одиночная игра',
  multiplayer: 'Многопользовательская',
  coop: 'Кооператив',
  online: 'Онлайн',
};

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function parseFeatures(features: unknown): Record<string, boolean> {
  if (!features) return {};
  if (typeof features === 'string') {
    try {
      return JSON.parse(features) as Record<string, boolean>;
    } catch {
      return {};
    }
  }
  if (typeof features === 'object') return features as Record<string, boolean>;
  return {};
}

const isDirectVideo = (url: string) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

export default function GameScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [game, setGame] = useState<GameDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeMedia, setActiveMedia] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState('');
  const [inLibrary, setInLibrary] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [libBusy, setLibBusy] = useState(false);
  const [reviews, setReviews] = useState<GameReview[]>([]);
  const [posCount, setPosCount] = useState(0);
  const [negCount, setNegCount] = useState(0);
  const [neutralCount, setNeutralCount] = useState(0);
  const { user } = useAuth();

  const applyReviews = (r: Awaited<ReturnType<typeof getGameReviews>>) => {
    setReviews(r.reviews);
    setPosCount(r.positive_count);
    setNegCount(r.negative_count);
    setNeutralCount(r.neutral_count);
  };
  const reloadReviews = () => {
    if (id) getGameReviews(id).then(applyReviews).catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get(`/games/${id}`)
      .then((r) => {
        if (!cancelled) setGame(r.data as GameDto);
      })
      .catch((e) => {
        if (!cancelled) setError(apiError(e, 'Не удалось загрузить игру'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get(`/library/status/${id}`)
      .then((r) => {
        if (cancelled) return;
        setInLibrary(!!r.data?.in_library);
        setFavorite(!!r.data?.favorite);
      })
      .catch(() => {});
    getGameReviews(id)
      .then((r) => {
        if (cancelled) return;
        applyReviews(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleLibrary = async () => {
    if (!id || libBusy) return;
    setLibBusy(true);
    try {
      if (inLibrary) {
        await api.post('/library/remove', { game_id: Number(id) });
        setInLibrary(false);
        setFavorite(false);
      } else {
        await api.post('/library/add', { game_id: Number(id) });
        setInLibrary(true);
      }
    } catch (e) {
      setError(apiError(e, 'Не удалось обновить библиотеку'));
    } finally {
      setLibBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!id || libBusy) return;
    setLibBusy(true);
    try {
      const res = await api.post('/library/favorite', { game_id: Number(id) });
      setFavorite(!!res.data?.favorite);
      setInLibrary(true);
    } catch (e) {
      setError(apiError(e, 'Не удалось обновить избранное'));
    } finally {
      setLibBusy(false);
    }
  };

  const copyText = useCallback(async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  }, []);

  const deepLink = `lustre://game/${id}`;
  const allMedia: GameMedia[] = game
    ? game.media || []
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={L.accent} />
        </View>
      ) : !game ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{error || 'Игра не найдена'}</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Назад</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            {game.header_image || game.banner_url ? (
              <Image
            source={{ uri: game.header_image || game.banner_url }}
            style={styles.heroImage}
            cachePolicy="memory-disk"
            transition={250}
          />
            ) : (
              <View style={styles.heroImage} />
            )}
            <View style={styles.heroOverlay} />

            <Pressable onPress={() => router.back()} style={styles.heroBack} hitSlop={8}>
              <ArrowLeft size={18} color={L.text} />
            </Pressable>

            <View style={styles.heroBody}>
              <View style={styles.badges}>
                {game.is_adult ? <Text style={[styles.badgeBase, styles.badgeNsfw]}>NSFW</Text> : null}
                {game.age_rating ? (
                  <View style={[styles.badgeBase, styles.badgeRow, styles.badgeAge]}>
                    <Shield size={11} color={L.accent} />
                    <Text style={[styles.badgeText, { color: L.accent, marginLeft: 4 }]}>{game.age_rating}</Text>
                  </View>
                ) : null}
                {game.release_date ? <Text style={styles.heroDate}>{formatDate(game.release_date)}</Text> : null}
              </View>
              <Text style={styles.heroTitle}>{game.title}</Text>
              <View style={styles.heroMeta}>
                {game.developer ? (
                  <View style={styles.heroMetaItem}>
                    <Building2 size={12} color={L.violet} />
                    <Text style={styles.heroMetaText}>{game.developer}</Text>
                  </View>
                ) : null}
                {game.publisher ? (
                  <View style={styles.heroMetaItem}>
                    <Disc size={12} color={CYAN} />
                    <Text style={styles.heroMetaText}>{game.publisher}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.body}>
            <ErrorBanner error={error} />

            {/* Actions */}
            <View style={styles.actions}>
              <ActionButton
                active={inLibrary}
                disabled={libBusy}
                onPress={toggleLibrary}
                icon={<Heart size={16} color={inLibrary ? L.accent : L.muted} fill={inLibrary ? L.accent : 'transparent'} />}
                label={inLibrary ? 'В библиотеке' : 'В библиотеку'}
              />
              {inLibrary ? (
                <ActionButton
                  active={favorite}
                  yellow
                  disabled={libBusy}
                  onPress={toggleFavorite}
                  icon={<Star size={16} color={favorite ? YELLOW : L.muted} fill={favorite ? YELLOW : 'transparent'} />}
                  label={favorite ? 'В избранном' : 'В избранное'}
                />
              ) : null}
              <ActionButton
                onPress={() => setShowQr(true)}
                icon={<MonitorDown size={16} color="#fff" />}
                label="Установить на ПК"
                primary
              />
            </View>

            {/* Media */}
            {allMedia.length > 0 ? (
              <Section title="Медиа" icon={<Info size={16} color={L.accent} />}>
                <MediaViewer
                  media={allMedia}
                  index={activeMedia}
                  onIndex={setActiveMedia}
                  onOpen={openExternalUrl}
                />
              </Section>
            ) : null}

            {/* About */}
            {game.description || game.about_game ? (
              <Section title="Об игре" icon={<Shield size={16} color={L.accent} />}>
                <View style={styles.card}>
                  {game.description ? (
                    <Text style={styles.paragraph}>{stripHtml(game.description)}</Text>
                  ) : null}
                  {game.about_game ? (
                    <Text style={[styles.paragraph, styles.paragraphMuted]}>{stripHtml(game.about_game)}</Text>
                  ) : null}
                </View>
              </Section>
            ) : null}

            {/* Requirements */}
            <Requirements reqs={game.requirements || []} />

            {/* Game modes */}
            <GameModes features={game.features} />

            {/* Details + Tags + Languages */}
            <Details game={game} />

            {/* Store links */}
            {game.store_links?.length ? (
              <Section title="Оригинал" icon={<ExternalLink size={16} color={L.accent} />}>
                {game.store_links.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.linkRow}
                    onPress={() => openExternalUrl(s.url)}>
                    <Text style={styles.linkLabel}>{STORE_LABEL[s.store] || s.store}</Text>
                    <Text style={styles.linkMeta} numberOfLines={1}>{s.url}</Text>
                    <ExternalLink size={14} color={L.muted} />
                  </Pressable>
                ))}
              </Section>
            ) : null}

            {/* Sources */}
            {game.sources?.length ? (
              <Section title="Источники" icon={<MonitorDown size={16} color={L.accent} />}>
                {game.sources.map((s) => (
                  <View key={s.id} style={styles.linkRow}>
                    <View style={styles.flexMin}>
                      <Text style={styles.linkLabel}>{s.label || 'Источник'}</Text>
                      <Text style={styles.linkMeta}>
                        {KIND_LABEL[s.kind] || s.kind}
                        {s.size ? ` · ${s.size}` : ''}
                      </Text>
                    </View>
                    {s.kind === 'torrent' && s.magnet_uri ? (
                      <Pressable onPress={() => void copyText('magnet', s.magnet_uri)} style={styles.iconBtn}>
                        <Copy size={14} color={L.text} />
                        <Text style={styles.iconBtnText}>{copied === 'magnet' ? 'Ок' : 'Magnet'}</Text>
                      </Pressable>
                    ) : s.url ? (
                      <Pressable onPress={() => openExternalUrl(s.url)} style={styles.iconBtn}>
                        <ExternalLink size={14} color={L.text} />
                        <Text style={styles.iconBtnText}>Открыть</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </Section>
            ) : null}

            <Reviews
              reviews={reviews}
              positive={posCount}
              neutral={neutralCount}
              negative={negCount}
              gameId={String(id)}
              meId={user?.id}
              canMod={canModerate(user?.role)}
              onChanged={reloadReviews}
            />
          </View>
        </ScrollView>
      )}

      <Modal transparent animationType="fade" visible={showQr} onRequestClose={() => setShowQr(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowQr(false)}>
          <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.qrScroll} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.qrClose} onPress={() => setShowQr(false)}>
              <X size={18} color={L.muted} />
            </Pressable>
            <Text style={styles.qrTitle}>Установить на ПК</Text>
            <Text style={styles.qrSub}>{game?.title}</Text>

            {game && showQr ? (
            <RemoteInstallPanel gameId={game.ID} sources={game.sources || []} hasMagnet={!!game.magnet_uri} onAddedToLibrary={() => setInLibrary(true)}>
            <View style={styles.qrBox}>
              <QRCode value={deepLink} size={210} backgroundColor="#ffffff" color="#000000" />
            </View>

            <Text style={styles.qrLink} numberOfLines={1}>{deepLink}</Text>

            <Pressable style={styles.copyBtn} onPress={() => void copyText('link', deepLink)}>
              <Copy size={15} color={L.text} />
              <Text style={styles.copyText}>{copied === 'link' ? 'Скопировано' : 'Скопировать ссылку'}</Text>
            </Pressable>

            <Text style={styles.qrHint}>
              Открой ссылку на компьютере с установленным Lustre — лаунчер откроет страницу игры.
            </Text>
            </RemoteInstallPanel>
            ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ErrorBanner({ error }: { error: string }) {
  if (!error) return null;
  return <Text style={styles.error}>{error}</Text>;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  active,
  yellow,
  primary,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
  yellow?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  const tint = primary
    ? { backgroundColor: L.accent, borderColor: L.accent }
    : active
      ? yellow
        ? { backgroundColor: 'rgba(250,204,21,0.12)', borderColor: 'rgba(250,204,21,0.35)' }
        : { backgroundColor: 'rgba(255,0,110,0.12)', borderColor: 'rgba(255,0,110,0.35)' }
      : { backgroundColor: L.card, borderColor: L.border };
  const textColor = primary ? '#fff' : active ? (yellow ? YELLOW : L.accent) : L.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, tint, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.actionText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function MediaViewer({
  media,
  index,
  onIndex,
  onOpen,
}: {
  media: GameMedia[];
  index: number;
  onIndex: (i: number) => void;
  onOpen: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = media[index];
  const prev = () => onIndex(index > 0 ? index - 1 : media.length - 1);
  const next = () => onIndex(index < media.length - 1 ? index + 1 : 0);

  // Полноэкранный просмотр — только изображения (видео открываются отдельно)
  const images = media.filter((m) => !m.is_video);
  const imgPos = Math.max(
    0,
    images.findIndex((m) => m.id === current?.id),
  );
  const modalImage = images[imgPos];
  const modalPrev = () =>
    onIndex(media.findIndex((m) => m.id === images[imgPos > 0 ? imgPos - 1 : images.length - 1].id));
  const modalNext = () =>
    onIndex(media.findIndex((m) => m.id === images[imgPos < images.length - 1 ? imgPos + 1 : 0].id));

  return (
    <View style={styles.gallery}>
      <View style={styles.galleryMain}>
        {current?.is_video ? (
          <Pressable style={styles.videoPlaceholder} onPress={() => onOpen(current.url)}>
            <Play size={30} color="#fff" fill="#fff" />
            <Text style={styles.videoText}>
              {isDirectVideo(current.url) ? 'Открыть видео' : 'Открыть видео (YouTube/сайт)'}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={styles.galleryImage} onPress={() => setOpen(true)}>
            <Image
            source={{ uri: current?.url }}
            style={styles.galleryImage}
            cachePolicy="memory-disk"
            transition={200}
          />
          </Pressable>
        )}

        {media.length > 1 ? (
          <>
            <Pressable style={[styles.navBtn, styles.navLeft]} onPress={prev} hitSlop={6}>
              <ChevronLeft size={18} color={L.text} />
            </Pressable>
            <Pressable style={[styles.navBtn, styles.navRight]} onPress={next} hitSlop={6}>
              <ChevronRight size={18} color={L.text} />
            </Pressable>
          </>
        ) : null}
      </View>

      {media.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {media.map((item, idx) => (
            <Pressable
              key={item.id}
              onPress={() => onIndex(idx)}
              style={[styles.thumb, idx === index ? styles.thumbActive : styles.thumbInactive]}>
              {item.is_video ? (
                <View style={styles.thumbVideo}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} cachePolicy="memory-disk" />
                  ) : null}
                  <Play size={14} color="#fff" fill="#fff" />
                </View>
              ) : (
                <Image
                  source={{ uri: item.url }}
                  style={styles.thumbImage}
                  cachePolicy="memory-disk"
                />
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Полноэкранный просмотр изображения */}
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.viewer}>
          <Pressable style={styles.viewerClose} onPress={() => setOpen(false)} hitSlop={10}>
            <X size={24} color="#fff" />
          </Pressable>

          <Pressable style={styles.viewerBody} onPress={() => setOpen(false)}>
            {modalImage ? (
              <Image
                source={{ uri: modalImage.url }}
                style={styles.viewerImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : null}
          </Pressable>

          {images.length > 1 ? (
            <>
              <Pressable style={[styles.viewerNav, styles.viewerNavLeft]} onPress={modalPrev} hitSlop={10}>
                <ChevronLeft size={28} color="#fff" />
              </Pressable>
              <Pressable style={[styles.viewerNav, styles.viewerNavRight]} onPress={modalNext} hitSlop={10}>
                <ChevronRight size={28} color="#fff" />
              </Pressable>
              <Text style={styles.viewerCounter}>
                {imgPos + 1} / {images.length}
              </Text>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function Requirements({ reqs }: { reqs: Requirement[] }) {
  const min = reqs.find((r) => r.type === 'minimum');
  const recommended = reqs.find((r) => r.type === 'recommended');
  if (!min && !recommended) return null;

  return (
    <Section title="Системные требования" icon={<Monitor size={16} color={CYAN} />}>
      <View style={styles.reqGrid}>
        {min ? (
          <View style={styles.card}>
            <Text style={[styles.reqTitle, { color: L.accent }]}>Минимальные</Text>
            <ReqList req={min} />
          </View>
        ) : null}
        {recommended ? (
          <View style={styles.card}>
            <Text style={[styles.reqTitle, { color: CYAN }]}>Рекомендуемые</Text>
            <ReqList req={recommended} />
          </View>
        ) : null}
      </View>
    </Section>
  );
}

function ReqList({ req }: { req: Requirement }) {
  const rows: [string, string][] = [
    ['OS', req.os],
    ['CPU', req.processor],
    ['GPU', req.graphics_card],
    ['RAM', req.ram],
    ['Место на диске', req.storage],
  ];
  return (
    <View style={styles.reqList}>
      {rows.filter(([, v]) => v).map(([label, value]) => (
        <View key={label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function GameModes({ features }: { features: unknown }) {
  const modes = parseFeatures(features);
  const active = Object.entries(modes).filter(([, v]) => v);
  if (active.length === 0) return null;

  return (
    <Section title="Игровые режимы" icon={<Gamepad2 size={16} color={L.accent} />}>
      <View style={styles.wrap}>
        {active.map(([key]) => (
          <Text key={key} style={[styles.chip, styles.chipAccent]}>
            {MODE_LABELS[key] || key}
          </Text>
        ))}
      </View>
    </Section>
  );
}

function Details({ game }: { game: GameDto }) {
  const hasDetails = game.developer || game.publisher || game.release_date || game.age_rating;
  const hasTags = (game.tags?.length || 0) > 0;
  const hasLangs = (game.languages?.length || 0) > 0;
  if (!hasDetails && !hasTags && !hasLangs) return null;

  return (
    <>
      {hasDetails ? (
        <Section title="Детали" icon={<TagsIcon size={16} color={L.violet} />}>
          <View style={styles.card}>
            {game.developer ? (
              <DetailRow icon={<Building2 size={14} color={L.muted} />} label="Разработчик" value={game.developer} />
            ) : null}
            {game.publisher ? (
              <DetailRow icon={<Disc size={14} color={L.muted} />} label="Издатель" value={game.publisher} />
            ) : null}
            {game.release_date ? (
              <DetailRow icon={<Calendar size={14} color={L.muted} />} label="Дата выхода" value={formatDate(game.release_date)} />
            ) : null}
            {game.age_rating ? (
              <DetailRow icon={<Shield size={14} color={L.muted} />} label="Возрастной рейтинг" value={game.age_rating} />
            ) : null}
          </View>
        </Section>
      ) : null}

      {hasTags ? (
        <Section title="Теги" icon={<TagsIcon size={16} color={L.violet} />}>
          <View style={styles.wrap}>
            {game.tags.map((t) => (
              <Text key={t.id} style={[styles.chip, styles.chipViolet]}>{t.name}</Text>
            ))}
          </View>
        </Section>
      ) : null}

      {hasLangs ? (
        <Section title="Языки" icon={<Languages size={16} color={L.violet} />}>
          <View style={styles.card}>
            {game.languages.map((lang) => (
              <View key={lang.id} style={styles.langRow}>
                <Text style={styles.langName}>{lang.name}</Text>
                <View style={styles.langBadges}>
                  {lang.interface ? <Text style={[styles.miniBadge, { color: CYAN }]}>UI</Text> : null}
                  {lang.audio ? <Text style={[styles.miniBadge, { color: CYAN }]}>Озвучка</Text> : null}
                  {lang.subtitles ? <Text style={[styles.miniBadge, { color: CYAN }]}>Субтитры</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelRow}>
        {icon}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function Reviews({
  reviews,
  positive,
  neutral,
  negative,
  gameId,
  meId,
  canMod,
  onChanged,
}: {
  reviews: GameReview[];
  positive: number;
  neutral: number;
  negative: number;
  gameId: string;
  meId?: number;
  canMod: boolean;
  onChanged: () => void;
}) {
  const mine = meId ? reviews.find((r) => r.user_id === meId) ?? null : null;
  const removeOther = (r: GameReview) => {
    Alert.alert('Удалить отзыв?', `Отзыв пользователя ${r.author?.profile?.display_name || r.author?.username || ''} будет удалён.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void deleteReview(r.id).then(onChanged).catch(() => {}) },
    ]);
  };
  // Как в лаунчере: доли от всех отзывов, нейтральные — отдельной жёлтой частью полосы
  const total = positive + neutral + negative;
  const percent = pct(positive, total);
  const neutralPercent = pct(neutral, total);

  return (
    <Section title="Отзывы" icon={<ThumbsUp size={16} color={L.accent} />}>
      {total > 0 ? (
        <View style={styles.ratingRow}>
          <View style={styles.ratingBar}>
            <View style={[styles.ratingFill, { width: `${percent}%` as `${number}%` }]} />
            <View style={[styles.ratingFillNeutral, { width: `${neutralPercent}%` as `${number}%` }]} />
          </View>
          <Text style={styles.ratingText}>
            {percent}% положительных{neutral > 0 ? ` · ${neutralPercent}% смешанных` : ''} · {total}
          </Text>
        </View>
      ) : null}

      {meId ? <ReviewComposer key={mine ? `mine-${mine.id}` : 'new'} gameId={gameId} mine={mine} onChanged={onChanged} /> : null}

      {reviews.length === 0 ? (
        <Text style={styles.reviewsEmpty}>Отзывов пока нет. Будь первым!</Text>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarText}>
                {(r.author?.profile?.display_name || r.author?.username || '?')[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.flexMin}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor} numberOfLines={1}>
                  {r.author?.profile?.display_name || r.author?.username || 'Пользователь'}
                </Text>
                {r.neutral ? (
                  <Meh size={12} color={L.neutral} accessibilityLabel="Смешанные впечатления" />
                ) : r.positive ? (
                  <ThumbsUp size={12} color={L.success} fill={L.success} />
                ) : (
                  <ThumbsDown size={12} color={L.danger} fill={L.danger} />
                )}
                <Text style={styles.reviewDate}>{formatReviewDate(r.created_at)}</Text>
                {canMod && r.user_id !== meId ? (
                  <Pressable onPress={() => removeOther(r)} hitSlop={8} accessibilityLabel="Удалить отзыв" style={styles.reviewDelete}>
                    <Trash2 size={12} color={L.muted} />
                  </Pressable>
                ) : null}
              </View>
              {r.content ? <Text style={styles.reviewContent}>{r.content}</Text> : null}
            </View>
          </View>
        ))
      )}
    </Section>
  );
}

function formatReviewDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return '';
  }
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center' },
  backLink: { marginTop: 16 },
  backLinkText: { color: L.accent, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  content: { paddingBottom: 56 },

  hero: { height: 240, justifyContent: 'flex-end' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: L.card },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,10,0.55)' },
  heroBack: { position: 'absolute', top: 12, left: 16, padding: 9, borderRadius: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroBody: { padding: 20 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  badgeBase: { borderRadius: 0, paddingHorizontal: 8, paddingVertical: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  badgeNsfw: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', fontSize: 10, fontFamily: 'Tiny5', },
  badgeAge: { backgroundColor: 'rgba(255,0,110,0.2)', borderWidth: 1, borderColor: 'rgba(255,0,110,0.3)' },
  badgeText: { fontSize: 10, fontFamily: 'Tiny5', },
  heroDate: { color: 'rgba(244,244,246,0.45)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', fontWeight: '600' },
  heroTitle: { color: L.text, fontSize: 30, fontFamily: 'Tiny5', letterSpacing: -0.5, textTransform: 'uppercase', fontStyle: 'italic' },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMetaText: { color: 'rgba(244,244,246,0.5)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },

  body: { paddingHorizontal: 16, paddingTop: 18 },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginBottom: 12 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 0, paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1 },
  actionText: { fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  disabled: { opacity: 0.5 },

  section: { marginTop: 26 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2 },

  card: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 0, borderWidth: 1, borderColor: 'rgba(131,56,236,0.12)', padding: 16 },
  paragraph: { color: 'rgba(244,244,246,0.62)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 21 },
  paragraphMuted: { color: 'rgba(244,244,246,0.42)', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(131,56,236,0.12)' },

  gallery: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 0, borderWidth: 1, borderColor: 'rgba(131,56,236,0.12)', overflow: 'hidden' },
  galleryMain: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  galleryImage: { width: '100%', height: '100%' },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  videoText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  navBtn: { position: 'absolute', top: '50%', marginTop: -18, padding: 8, borderRadius: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  navLeft: { left: 10 },
  navRight: { right: 10 },
  thumbs: { gap: 8, padding: 10 },
  thumb: { width: 104, height: 60, borderRadius: 0, overflow: 'hidden', borderWidth: 2 },
  thumbActive: { borderColor: L.accent },
  thumbInactive: { borderColor: 'transparent', opacity: 0.5 },
  thumbImage: { width: '100%', height: '100%' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', top: 54, right: 20, zIndex: 10, padding: 8 },
  viewerBody: { flex: 1, justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
    padding: 14,
    borderRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  viewerNavLeft: { left: 12 },
  viewerNavRight: { right: 12 },
  viewerCounter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 2,
  },
  thumbVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },

  reqGrid: { gap: 10 },
  reqTitle: { fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  reqList: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { color: 'rgba(244,244,246,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { color: 'rgba(244,244,246,0.7)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 0, borderWidth: 1, overflow: 'hidden' },
  chipAccent: { color: L.accent, borderColor: 'rgba(255,0,110,0.25)', backgroundColor: 'rgba(255,0,110,0.1)' },
  chipViolet: { color: 'rgba(131,56,236,0.9)', borderColor: 'rgba(131,56,236,0.25)', backgroundColor: 'rgba(131,56,236,0.1)' },

  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  langName: { color: 'rgba(244,244,246,0.65)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  langBadges: { flexDirection: 'row', gap: 6 },
  miniBadge: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, backgroundColor: 'rgba(34,211,238,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0, overflow: 'hidden' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 0, padding: 14, marginBottom: 8 },
  linkLabel: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  linkMeta: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  flexMin: { flex: 1, minWidth: 0 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  iconBtnText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },

  ratingRow: { marginBottom: 14, gap: 8 },
  ratingBar: { height: 8, borderRadius: 0, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row' },
  ratingFill: { height: '100%', backgroundColor: L.success },
  ratingFillNeutral: { height: '100%', backgroundColor: L.neutral },
  ratingText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  reviewsEmpty: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingVertical: 20 },
  reviewCard: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 0, borderWidth: 1, borderColor: 'rgba(131,56,236,0.12)', padding: 12, marginBottom: 8 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reviewAuthor: { color: 'rgba(244,244,246,0.75)', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', maxWidth: '60%' },
  reviewDelete: { marginLeft: 'auto', padding: 2 },
  reviewDate: { color: 'rgba(244,244,246,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  reviewContent: { color: 'rgba(244,244,246,0.5)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18, marginTop: 5 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrCard: { width: '100%', maxWidth: 340, maxHeight: '90%', backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong },
  qrScroll: { padding: 24, alignItems: 'center' },
  qrClose: { position: 'absolute', top: 14, right: 14, padding: 4 },
  qrTitle: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 2 },
  qrSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 6, textAlign: 'center' },
  qrBox: { backgroundColor: '#fff', padding: 14, borderRadius: 0, marginTop: 18 },
  qrLink: { color: L.muted, fontSize: 11, fontFamily: 'monospace', marginTop: 14 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 0, borderWidth: 1, borderColor: L.border },
  copyText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  qrHint: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 16, lineHeight: 16 },
}));
