import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronLeft, Globe, Lock, Search, X } from 'lucide-react-native';

import {
  createCommunity,
  getCommunityGames,
  getCommunityThemes,
  uploadCommunityImage,
  type Community,
  type CommunityGame,
  type CommunityTheme,
} from '@/api/community';
import InviteModal from '@/components/community/InviteModal';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function CreateCommunityScreen() {
  const [games, setGames] = useState<CommunityGame[]>([]);
  const [themes, setThemes] = useState<CommunityTheme[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [gameId, setGameId] = useState<number | null>(null);
  const [themeId, setThemeId] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [gameFilter, setGameFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Community | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getCommunityGames(), getCommunityThemes()])
      .then(([gs, ts]) => {
        if (!alive) return;
        setGames(gs);
        setThemes(ts);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedGame = games.find((g) => g.ID === gameId) || null;
  const filteredGames = games.filter((g) =>
    g.title.toLowerCase().includes(gameFilter.trim().toLowerCase()),
  );

  const pickCover = async () => {
    if (coverBusy) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const ext = (a.uri.split('.').pop() || 'jpg').split('?')[0];
      setCoverBusy(true);
      const url = await uploadCommunityImage({
        uri: a.uri,
        name: a.fileName || `cover_${Date.now()}.${ext}`,
        mimeType: a.mimeType || 'image/jpeg',
      });
      setCoverUrl(url);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить обложку'));
    } finally {
      setCoverBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Введите название сообщества');
      return;
    }
    if (!gameId) {
      setError('Выберите категорию (игру)');
      return;
    }
    if (!themeId) {
      setError('Выберите тематику');
      return;
    }
    setSubmitting(true);
    try {
      const community = await createCommunity({
        name: name.trim(),
        description: description.trim(),
        cover_url: coverUrl,
        game_id: gameId,
        theme_id: themeId,
        is_private: isPrivate,
      });
      if (community.is_private && community.invite_code) {
        setCreated(community);
      } else {
        router.replace('/community' as Href);
      }
    } catch (e) {
      setError(apiError(e, 'Не удалось создать сообщество'));
      setSubmitting(false);
    }
  };

  const closeCreated = () => {
    setCreated(null);
    router.replace('/community' as Href);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={16} color={L.accent} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>
            Новое <Text style={styles.accent}>сообщество</Text>
          </Text>
          <Text style={styles.topSub}>Название и игра — по желанию обложка и тематика</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Label>Название *</Label>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={120}
          placeholder="Например: Найт-Сити после заката"
        />

        <Label>Описание</Label>
        <Input
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
          placeholder="О чём это сообщество?"
        />

        <Label>Обложка сообщества (необязательно)</Label>
        {coverBusy ? (
          <View style={styles.coverBusy}>
            <ActivityIndicator color={L.accent} />
            <Text style={styles.coverBusyText}>Загружаем обложку...</Text>
          </View>
        ) : coverUrl ? (
          <View style={styles.coverWrap}>
            <Image source={{ uri: coverUrl }} style={styles.cover} />
            <Pressable onPress={() => setCoverUrl('')} style={styles.coverRemove} hitSlop={8}>
              <X size={14} color={L.danger} />
              <Text style={styles.coverRemoveText}>Убрать</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void pickCover()} style={({ pressed }) => [styles.coverBtn, pressed && styles.pressed]}>
            <Camera size={18} color={L.violet} />
            <Text style={styles.coverBtnText}>Выбрать обложку</Text>
          </Pressable>
        )}

        <Label>Категория (игра) *</Label>
        {selectedGame ? (
          <View style={styles.selectedGame}>
            {selectedGame.header_image ? (
              <Image source={{ uri: selectedGame.header_image }} style={styles.selectedGameImg} />
            ) : (
              <View style={[styles.selectedGameImg, styles.selectedGameFallback]} />
            )}
            <View style={styles.flex}>
              <Text style={styles.selectedLabel}>Выбранная категория</Text>
              <Text style={styles.selectedTitle} numberOfLines={2}>
                {selectedGame.title}
              </Text>
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            setGameFilter('');
            setGamePickerOpen(true);
          }}
          style={({ pressed }) => [styles.pickerBtn, pressed && styles.pressed]}>
          <Search size={16} color={L.muted} />
          <Text style={styles.pickerBtnText}>
            {selectedGame ? 'Изменить игру' : 'Выбрать игру из каталога'}
          </Text>
        </Pressable>

        <Label>Тематика *</Label>
        {loading ? (
          <ActivityIndicator color={L.accent} style={styles.loader} />
        ) : themes.length === 0 ? (
          <Text style={styles.dim}>Тематики ещё не загружены</Text>
        ) : (
          <View style={styles.wrap}>
            {themes.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setThemeId(t.id)}
                style={[styles.chip, themeId === t.id && styles.chipOn]}>
                <Text style={[styles.chipText, themeId === t.id && styles.chipTextOn]}>{t.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Label>Вид сообщества *</Label>
        <View style={styles.visibilityRow}>
          <Pressable
            onPress={() => setIsPrivate(false)}
            style={[styles.option, !isPrivate && styles.optionOn]}>
            <View style={styles.optionHead}>
              <Globe size={16} color={!isPrivate ? L.accent : L.muted} />
              <Text style={[styles.optionTitle, !isPrivate && styles.optionTitleOn]}>Публичное</Text>
              {!isPrivate ? <Check size={14} color={L.accent} style={styles.check} /> : null}
            </View>
            <Text style={styles.optionText}>
              Сообщество видно всем игрокам Lustre в общем списке
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setIsPrivate(true)}
            style={[styles.option, isPrivate && styles.optionOn]}>
            <View style={styles.optionHead}>
              <Lock size={16} color={isPrivate ? L.violet : L.muted} />
              <Text style={[styles.optionTitle, isPrivate && styles.optionTitleOn]}>Приватное</Text>
              {isPrivate ? <Check size={14} color={L.violet} style={styles.check} /> : null}
            </View>
            <Text style={styles.optionText}>
              Скрыто из общего списка. Вступить можно только по ссылке-приглашению, которую видите вы
            </Text>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        <Button
          title={submitting ? 'Создаём...' : 'Создать сообщество'}
          onPress={() => void submit()}
          loading={submitting}
          disabled={loading}
        />
        <Button title="Отмена" onPress={() => router.back()} variant="ghost" />
      </ScrollView>

      <Modal visible={gamePickerOpen} transparent animationType="slide" onRequestClose={() => setGamePickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGamePickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Категория (игра)</Text>
              <Pressable onPress={() => setGamePickerOpen(false)} hitSlop={8}>
                <X size={18} color={L.muted} />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Search size={15} color={L.muted} />
              <TextInput
                value={gameFilter}
                onChangeText={setGameFilter}
                placeholder="Поиск игры в каталоге..."
                placeholderTextColor={L.muted}
                style={styles.search}
              />
            </View>

            <FlatList
              data={filteredGames}
              keyExtractor={(item) => String(item.ID)}
              style={styles.gameList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.dim}>Игры не найдены</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setGameId(item.ID);
                    setError('');
                    setGamePickerOpen(false);
                  }}
                  style={[styles.gameRow, gameId === item.ID && styles.gameRowOn]}>
                  {item.header_image ? (
                    <Image source={{ uri: item.header_image }} style={styles.gameImg} />
                  ) : (
                    <View style={[styles.gameImg, styles.selectedGameFallback]} />
                  )}
                  <Text style={styles.gameTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {gameId === item.ID ? <Check size={16} color={L.accent} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {created ? (
        <InviteModal visible name={created.name} code={created.invite_code || ''} onClose={closeCreated} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    color: L.accent,
    fontSize: 13, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topTitleWrap: { flex: 1 },
  topTitle: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', textAlign: 'right' },
  accent: { color: L.accent },
  topSub: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'right',
    marginTop: 2,
  },

  content: { padding: 20, paddingBottom: 48 },

  coverBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingVertical: 22,
    backgroundColor: L.cardAlt,
  },
  coverBusyText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  coverWrap: { gap: 8 },
  cover: { width: '100%', height: 170, borderRadius: 0, backgroundColor: '#000' },
  coverRemove: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  coverRemoveText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase' },
  coverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingVertical: 22,
    backgroundColor: L.cardAlt,
  },
  coverBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  selectedGame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(131,56,236,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(131,56,236,0.35)',
    borderRadius: 0,
    padding: 10,
    marginBottom: 10,
  },
  selectedGameImg: { width: 76, height: 40, borderRadius: 0, backgroundColor: '#000' },
  selectedGameFallback: { backgroundColor: 'rgba(131,56,236,0.3)' },
  selectedLabel: {
    color: L.accent,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  selectedTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', marginTop: 3 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: L.card,
  },
  pickerBtnText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },

  loader: { marginTop: 8 },
  dim: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: L.card,
  },
  chipOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  chipText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  chipTextOn: { color: '#fff' },

  visibilityRow: { gap: 10 },
  option: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    backgroundColor: L.card,
  },
  optionOn: { borderColor: L.borderStrong, backgroundColor: 'rgba(131,56,236,0.1)' },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionTitle: { color: L.muted, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', flex: 1 },
  optionTitleOn: { color: L.text },
  check: { marginLeft: 'auto' },
  optionText: { color: 'rgba(244,244,246,0.45)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17, marginTop: 8 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: L.bg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderColor: L.borderStrong,
    maxHeight: '75%',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', letterSpacing: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  search: { flex: 1, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 10 },
  gameList: { flexGrow: 0 },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 0,
  },
  gameRowOn: { backgroundColor: 'rgba(255,0,110,0.1)' },
  gameImg: { width: 64, height: 32, borderRadius: 0, backgroundColor: '#000' },
  gameTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', flex: 1 },
}));
