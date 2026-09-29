import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type AvatarProps = {
  name: string;
  uri?: string | null;
  size: number;
  backgroundColor: string;
};

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

export default function Avatar({ name, uri, size, backgroundColor }: AvatarProps) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={shape} resizeMode="cover" />;
  return (
    <View style={[styles.fallback, shape, { backgroundColor }]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '900' },
});
