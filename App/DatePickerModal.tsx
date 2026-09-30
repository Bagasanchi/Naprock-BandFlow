import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type DatePickerColors = {
  surface: string;
  border: string;
  title: string;
  body: string;
  muted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  backdrop: string;
};

type DatePickerModalProps = {
  visible: boolean;
  value: Date | null;
  minimumDate?: Date;
  colors: DatePickerColors;
  onSelect: (date: Date) => void;
  onClose: () => void;
};

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a: Date | null, b: Date) => Boolean(a) && a!.getFullYear() === b.getFullYear() && a!.getMonth() === b.getMonth() && a!.getDate() === b.getDate();

// Calendar written in plain React Native so it works the same in Expo Go, development builds, and the web.
export default function DatePickerModal({ visible, value, minimumDate, colors, onSelect, onClose }: DatePickerModalProps) {
  const [month, setMonth] = useState(() => startOfDay(value ?? new Date()));

  useEffect(() => {
    if (visible) setMonth(startOfDay(value ?? new Date()));
  }, [visible, value]);

  const today = startOfDay(new Date());
  const minimum = minimumDate ? startOfDay(minimumDate) : null;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const canGoBack = !minimum || new Date(year, monthIndex, 0) >= minimum;

  const shiftMonth = (delta: number) => setMonth(new Date(year, monthIndex + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close calendar" style={[styles.backdrop, { backgroundColor: colors.backdrop }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Previous month" disabled={!canGoBack} onPress={() => shiftMonth(-1)} hitSlop={10} style={[styles.navButton, { borderColor: colors.border, opacity: canGoBack ? 1 : 0.35 }]}>
              <Text style={[styles.navText, { color: colors.title }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.title }]}>
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable accessibilityLabel="Next month" onPress={() => shiftMonth(1)} hitSlop={10} style={[styles.navButton, { borderColor: colors.border }]}>
              <Text style={[styles.navText, { color: colors.title }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {weekdays.map((day) => (
              <Text key={day} style={[styles.weekday, { color: colors.muted }]}>{day}</Text>
            ))}
            {cells.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
              const disabled = Boolean(minimum && date < minimum);
              const selected = sameDay(value, date);
              const isToday = sameDay(today, date);
              return (
                <Pressable
                  key={date.toISOString()}
                  accessibilityLabel={date.toDateString()}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => onSelect(date)}
                  style={styles.cell}
                >
                  <View style={[styles.day, selected && { backgroundColor: colors.accent }, !selected && isToday && { borderWidth: 1, borderColor: colors.accent }]}>
                    <Text style={[styles.dayText, { color: selected ? colors.accentText : disabled ? colors.muted : colors.title, opacity: disabled ? 0.4 : 1 }]}>
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => onSelect(today)} disabled={Boolean(minimum && today < minimum)} style={[styles.footerButton, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.footerText, { color: colors.accent }]}>Today</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.footerButton, { borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.body }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 22, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navButton: { width: 36, height: 36, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 22, lineHeight: 24, fontWeight: '600' },
  monthTitle: { fontSize: 16, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  footerButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footerText: { fontSize: 14, fontWeight: '800' },
});
