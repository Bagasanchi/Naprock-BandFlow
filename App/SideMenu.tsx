import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { getRoleTheme, type Role } from '../lib/roleTheme';

type SideMenuProps = {
  isDarkTheme: boolean;
  role: Role;
  name: string;
  email?: string;
  jobTitle?: string;
  avatar?: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export default function SideMenu({ isDarkTheme, role, name, email, jobTitle, avatar, onOpenProfile, onOpenSettings, onLogout }: SideMenuProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.82);
  const [isOpen, setIsOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const theme = getRoleTheme(role, isDarkTheme);

  useEffect(() => {
    if (!isOpen) return;
    Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isOpen, progress]);

  const close = (after?: () => void) => {
    Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setIsOpen(false);
      after?.();
    });
  };

  const items = [
    { icon: '👤', title: 'Profile', detail: 'Photo, name, and contact info', onPress: onOpenProfile },
    { icon: '⚙️', title: 'Settings', detail: 'Appearance, password, and connection', onPress: onOpenSettings },
  ];

  return (
    <>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={() => setIsOpen(true)}
          style={[
            styles.menuButton,
            {
              top: insets.top + 8,
              backgroundColor: isDarkTheme ? '#1B2A42' : '#FFFFFF',
              borderColor: isDarkTheme ? '#405574' : '#BFD1E8',
            },
          ]}
        >
          {[0, 1, 2].map((line) => <View key={line} style={[styles.menuLine, { backgroundColor: isDarkTheme ? '#F4F8FF' : '#163E6D' }]} />)}
        </Pressable>
      </View>

      <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backdrop, opacity: progress }]}>
          <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={() => close()} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
              backgroundColor: theme.sheet,
              borderColor: theme.border,
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }],
            },
          ]}
        >
          <View style={[styles.profileCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
            <Avatar name={name} uri={avatar} size={56} backgroundColor={theme.accent} />
            <View style={styles.profileCopy}>
              <Text style={[styles.name, { color: theme.title }]} numberOfLines={1}>{name}</Text>
              {email ? <Text style={[styles.detail, { color: theme.body }]} numberOfLines={1}>{email}</Text> : null}
              <View style={[styles.roleChip, { backgroundColor: theme.accent }]}>
                <Text style={[styles.roleChipText, { color: theme.accentText }]}>{jobTitle || (role === 'boss' ? 'Boss' : 'Worker')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.items}>
            {items.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => close(item.onPress)}
                style={({ pressed }) => [styles.item, { borderColor: theme.border, backgroundColor: pressed ? theme.accentSoft : 'transparent' }]}
              >
                <Text style={styles.itemIcon}>{item.icon}</Text>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemTitle, { color: theme.title }]}>{item.title}</Text>
                  <Text style={[styles.itemDetail, { color: theme.body }]}>{item.detail}</Text>
                </View>
                <Text style={[styles.chevron, { color: theme.body }]}>›</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => close(onLogout)}
            style={({ pressed }) => [styles.logout, { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.logoutText, { color: theme.danger }]}>Log out</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    width: 42,
    height: 38,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  menuLine: { width: 18, height: 2, borderRadius: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '900' },
  detail: { fontSize: 12, marginTop: 2 },
  roleChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginTop: 7 },
  roleChipText: { fontSize: 10, fontWeight: '900' },
  items: { marginTop: 18, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  itemIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  itemCopy: { flex: 1, marginLeft: 10 },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '600', marginLeft: 6 },
  logout: { marginTop: 'auto', minHeight: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 14, fontWeight: '900' },
});
