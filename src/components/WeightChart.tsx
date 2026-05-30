import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useAppTheme } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeightDataPoint {
  date: string; // ISO date string
  weightKg: number;
  note?: string; // Optional annotation (e.g., "Surgery", "Illness")
}

export interface WeightRange {
  min: number;
  max: number;
  label?: string;
}

export type DateRangeFilter = '1M' | '3M' | '1Y' | 'ALL';

interface Props {
  data: WeightDataPoint[];
  vetRecommendedRange?: WeightRange;
  onExport?: () => void;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 48 };

function filterDataByRange(data: WeightDataPoint[], range: DateRangeFilter): WeightDataPoint[] {
  if (range === 'ALL') return data;

  const now = new Date();
  const cutoff = new Date(now);

  switch (range) {
    case '1M':
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoff.setMonth(now.getMonth() - 3);
      break;
    case '1Y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return data.filter((d) => new Date(d.date) >= cutoff);
}

function formatDateLabel(iso: string, compact = false): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (compact) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

const WeightChart: React.FC<Props> = ({ data, vetRecommendedRange, onExport, height = 300 }) => {
  const colors = useAppTheme();
  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>('3M');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const filteredData = useMemo(
    () => filterDataByRange(data, selectedRange).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data, selectedRange],
  );

  const chartWidth = SCREEN_WIDTH - 32; // Account for container padding
  const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  const { minWeight, maxWeight, yScale, xScale } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minWeight: 0, maxWeight: 10, yScale: () => 0, xScale: () => 0 };
    }

    const weights = filteredData.map((d) => d.weightKg);
    let min = Math.min(...weights);
    let max = Math.max(...weights);

    // Include vet range in scale if provided
    if (vetRecommendedRange) {
      min = Math.min(min, vetRecommendedRange.min);
      max = Math.max(max, vetRecommendedRange.max);
    }

    // Add 10% padding to y-axis
    const padding = (max - min) * 0.1;
    min = Math.max(0, min - padding);
    max = max + padding;

    const yScale = (weight: number) => {
      const ratio = (weight - min) / (max - min);
      return chartHeight - ratio * chartHeight;
    };

    const xScale = (index: number) => {
      return (index / Math.max(1, filteredData.length - 1)) * (chartWidth - CHART_PADDING.left - CHART_PADDING.right);
    };

    return { minWeight: min, maxWeight: max, yScale, xScale };
  }, [filteredData, vetRecommendedRange, chartHeight, chartWidth]);

  // ── Render empty state ────────────────────────────────────────────────────

  if (filteredData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Weight & Growth Chart</Text>
        </View>
        <View style={[styles.emptyContainer, { height }]}>
          <Text style={[styles.emptyText, { color: colors.placeholder }]}>
            No weight data available for the selected period.
          </Text>
        </View>
      </View>
    );
  }

  // ── Build SVG path ────────────────────────────────────────────────────────

  const linePath = filteredData
    .map((point, idx) => {
      const x = CHART_PADDING.left + xScale(idx);
      const y = CHART_PADDING.top + yScale(point.weightKg);
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // ── Y-axis labels ─────────────────────────────────────────────────────────

  const yTicks = [minWeight, (minWeight + maxWeight) / 2, maxWeight];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Weight & Growth Chart</Text>
        {onExport && (
          <TouchableOpacity
            onPress={onExport}
            style={[styles.exportBtn, { backgroundColor: colors.infoMuted }]}
            accessibilityRole="button"
          >
            <Text style={[styles.exportText, { color: colors.info }]}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date range filters */}
      <View style={styles.filterRow}>
        {(['1M', '3M', '1Y', 'ALL'] as DateRangeFilter[]).map((range) => (
          <TouchableOpacity
            key={range}
            onPress={() => setSelectedRange(range)}
            style={[
              styles.filterBtn,
              { backgroundColor: colors.muted },
              selectedRange === range && { backgroundColor: colors.info },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedRange === range }}
          >
            <Text
              style={[
                styles.filterText,
                { color: colors.secondaryText },
                selectedRange === range && styles.filterTextActive,
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={height}>
          <Defs>
            <LinearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0.06" />
            </LinearGradient>
          </Defs>

          {/* Vet recommended range overlay */}
          {vetRecommendedRange && (
            <Rect
              x={CHART_PADDING.left}
              y={CHART_PADDING.top + yScale(vetRecommendedRange.max)}
              width={chartWidth - CHART_PADDING.left - CHART_PADDING.right}
              height={yScale(vetRecommendedRange.min) - yScale(vetRecommendedRange.max)}
              fill="url(#rangeGradient)"
            />
          )}

          {/* Y-axis grid lines */}
          {yTicks.map((tick, idx) => {
            const y = CHART_PADDING.top + yScale(tick);
            return (
              <Line
                key={idx}
                x1={CHART_PADDING.left}
                y1={y}
                x2={chartWidth - CHART_PADDING.right}
                y2={y}
                stroke={colors.chartGrid}
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map((tick, idx) => {
            const y = CHART_PADDING.top + yScale(tick);
            return (
              <SvgText
                key={idx}
                x={CHART_PADDING.left - 8}
                y={y + 4}
                fontSize="11"
                fill={colors.chartAxis}
                textAnchor="end"
              >
                {tick.toFixed(1)}
              </SvgText>
            );
          })}

          {/* Line chart */}
          <Path d={linePath} stroke={colors.chartLine} strokeWidth="2.5" fill="none" />

          {/* Data points */}
          {filteredData.map((point, idx) => {
            const x = CHART_PADDING.left + xScale(idx);
            const y = CHART_PADDING.top + yScale(point.weightKg);
            const isAnnotated = Boolean(point.note);
            const isSelected = selectedPoint === idx;

            return (
              <React.Fragment key={idx}>
                <Circle
                  cx={x}
                  cy={y}
                  r={isAnnotated ? 6 : 4}
                  fill={isAnnotated ? colors.chartAnnotation : colors.chartLine}
                  stroke={colors.card}
                  strokeWidth="2"
                  onPress={() => setSelectedPoint(isSelected ? null : idx)}
                />
                {isSelected && (
                  <Circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="none"
                    stroke={colors.chartLine}
                    strokeWidth="1.5"
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* X-axis labels (show every nth point to avoid crowding) */}
          {filteredData.map((point, idx) => {
            if (filteredData.length > 10 && idx % Math.ceil(filteredData.length / 6) !== 0) {
              return null;
            }
            const x = CHART_PADDING.left + xScale(idx);
            const y = height - CHART_PADDING.bottom + 16;
            return (
              <SvgText
                key={idx}
                x={x}
                y={y}
                fontSize="10"
                fill={colors.chartAxis}
                textAnchor="middle"
                transform={`rotate(-45, ${x}, ${y})`}
              >
                {formatDateLabel(point.date, true)}
              </SvgText>
            );
          })}
        </Svg>

        {/* Selected point tooltip */}
        {selectedPoint !== null && filteredData[selectedPoint] && (
          <View style={[styles.tooltip, { backgroundColor: colors.cardElevated }]}>
            <Text style={[styles.tooltipDate, { color: colors.secondaryText }]}>
              {formatDateLabel(filteredData[selectedPoint].date)}
            </Text>
            <Text style={[styles.tooltipWeight, { color: colors.text }]}>
              {filteredData[selectedPoint].weightKg.toFixed(2)} kg
            </Text>
            {filteredData[selectedPoint].note && (
              <Text style={[styles.tooltipNote, { color: colors.warning }]}>
                {filteredData[selectedPoint].note}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Legend */}
      {vetRecommendedRange && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendBox,
                { backgroundColor: colors.chartRangeFill, borderColor: colors.primary },
              ]}
            />
            <Text style={[styles.legendText, { color: colors.secondaryText }]}>
              Vet Recommended: {vetRecommendedRange.min.toFixed(1)} -{' '}
              {vetRecommendedRange.max.toFixed(1)} kg
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  chartContainer: {
    position: 'relative',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 10,
    borderRadius: 8,
    minWidth: 140,
  },
  tooltipDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  tooltipWeight: {
    fontSize: 16,
    fontWeight: '700',
  },
  tooltipNote: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  legend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 20,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
  },
});

export default WeightChart;
