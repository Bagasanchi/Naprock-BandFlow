import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Workload, WorkloadLevel } from '../lib/api';

type WorkloadGaugeProps = {
  workload: Workload;
  isDarkTheme: boolean;
  textColor: string;
};

export const workloadLabels: Record<WorkloadLevel, string> = { light: 'Light', busy: 'Busy', overloaded: 'Overloaded' };

export function workloadColor(level: WorkloadLevel, isDarkTheme: boolean) {
  const colors = isDarkTheme
    ? { light: '#7CE1BB', busy: '#FFD285', overloaded: '#FF8F8F' }
    : { light: '#14744E', busy: '#A56800', overloaded: '#D93A3A' };
  return colors[level];
}

// A worker's open works as a bar that fills up at the Overloaded threshold. It only informs:
// nothing in the app stops a boss from assigning to an overloaded worker.
export default function WorkloadGauge({ workload, isDarkTheme, textColor }: WorkloadGaugeProps) {
  const color = workloadColor(workload.level, isDarkTheme);
  const fill = Math.min(1, workload.open / Math.max(1, workload.overloaded_at));
  return (
    <View accessible accessibilityLabel={`${workload.open} open works, ${workloadLabels[workload.level]} workload`}>
      <View style={styles.labels}>
        <Text style={[styles.count, { color: textColor }]}>{workload.open} open work{workload.open === 1 ? '' : 's'}</Text>
        <Text style={[styles.level, { color }]}>{workloadLabels[workload.level]}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.12)' : 'rgba(47, 10, 75, 0.1)' }]}>
        <View style={[styles.fill, { backgroundColor: color, width: `${Math.round(fill * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 11, fontWeight: '700' },
  level: { fontSize: 11, fontWeight: '900' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 3 },
});
