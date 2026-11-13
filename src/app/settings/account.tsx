import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { Avatar, Row, Section } from '@/components/settings/ui';
import { Button } from '@/components/ui/form';
import { L } from '@/constants/lustre';

export default function AccountSettingsScreen() {
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const doLogout = async () => {
    setLogoutOpen(false);
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Аккаунт</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userCard}>
          <Avatar url={user?.profile?.avatar_url} name={user?.username} size={64} />
          <View style={styles.userBody}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.profile?.display_name || user?.username || 'Гость'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || 'Не указан'}
            </Text>
          </View>
          <Pressable
            onPress={() => user && router.push(`/profile/${user.username}` as Href)}
            style={styles.profileBtn}
            hitSlop={8}>
            <Text style={styles.profileBtnText}>Профиль</Text>
          </Pressable>
        </View>

        <Section title="Разделы">
          <Row
            label="Друзья"
            hint="Управление списком друзей"
            onPress={() => router.push('/friends')}
            last
          />
        </Section>

        <Section title="Основное">
          <Row label="Ваш код друга" value={user?.friend_code || 'Не задан'} />
          <Row label="Адрес эл. почты" value={user?.email || 'Не указан'} last />
        </Section>

        <Button title="Выйти из аккаунта" onPress={() => setLogoutOpen(true)} variant="ghost" />
        <Button title="Удалить аккаунт" onPress={() => setDeleteOpen(true)} variant="ghost" />

        <View style={styles.dangerBox}>
          <Text style={styles.dangerTitle}>Опасная зона</Text>
          <Text style={styles.dangerText}>
            Удаление аккаунта необратимо: исчезнут карточка, витрина, значки и вся история активности.
            Восстановить данные будет нельзя.
          </Text>
        </View>
      </ScrollView>

      {/* Выход */}
      <Modal visible={logoutOpen} transparent animationType="fade" onRequestClose={() => setLogoutOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Выйти из аккаунта</Text>
            <Text style={styles.modalText}>Вы уверены, что хотите выйти?</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setLogoutOpen(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Отмена</Text>
              </Pressable>
              <Pressable onPress={doLogout} style={[styles.modalBtn, styles.modalBtnDanger]}>
                <Text style={styles.modalBtnText}>Выйти</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Удаление аккаунта */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Удалить аккаунт</Text>
            <Text style={styles.modalText}>
              Удаление аккаунта необратимо. Запрос на удаление оформляется через поддержку.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteOpen(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDeleteOpen(false);
                  router.push('/support/new?category=account' as Href);
                }}
                style={[styles.modalBtn, styles.modalBtnDanger]}>
                <Text style={styles.modalBtnText}>К поддержке</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
  },
  userBody: { flex: 1, minWidth: 0 },
  userName: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  userEmail: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  profileBtn: { borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  profileBtnText: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerBox: {
    backgroundColor: 'rgba(255,77,79,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.35)',
    borderRadius: 0,
    padding: 16,
    marginTop: 8,
  },
  dangerTitle: {
    color: L.danger,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  dangerText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 20,
  },
  modalTitle: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', marginBottom: 8 },
  modalText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginBottom: 18 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 0, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { borderWidth: 1, borderColor: L.border },
  modalBtnGhostText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  modalBtnDanger: { backgroundColor: L.danger },
  modalBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
}));
