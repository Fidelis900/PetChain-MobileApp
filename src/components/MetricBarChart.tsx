import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface ChartPoint {
  label: string;
  value: number;
}

interface Props {
  points: ChartPoint[];
  color: string;
  unit?: string;
  height?: number;
}

const MetricBarChart: React.FC<Props> = ({ points, color, unit = '', height = 168 }) => {
  if (points.length === 0) {
    return <Text style={styles.empty}>No data points for this metric yet.</Text>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const labelBand = 28;
  const barMax = Math.max(48, height - labelBand);

  const lastN = points.slice(-14);

  return (
    <View style={styles.wrap}>
      <View style={[styles.barsRow, { height: barMax }]}>
        {lastN.map((p, i) => {
          const h = ((p.value - min) / span) * barMax * 0.82 + barMax * 0.12;
          return (
            <View key={`${p.label}-${i}`} style={styles.barCol}>
              <View style={[styles.bar, { height: Math.max(6, h), backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {lastN.map((p, i) => (
          <Text key={`lbl-${i}`} style={styles.barLabel} numberOfLines={1}>
            {p.label}
          </Text>
        ))}
      </View>
      {unit ? <Text style={styles.unitHint}>Unit: {unit}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  empty: { color: '#888', fontSize: 14, paddingVertical: 12, textAlign: 'center' },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barCol: { flex: 1, alignItems: 'center', marginHorizontal: 1 },
  bar: { width: '78%', borderRadius: 4, minHeight: 6 },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  barLabel: { flex: 1, fontSize: 9, color: '#666', textAlign: 'center' },
  unitHint: { fontSize: 12, color: '#999', marginTop: 6, textAlign: 'right' },
});

export default MetricBarChart;
