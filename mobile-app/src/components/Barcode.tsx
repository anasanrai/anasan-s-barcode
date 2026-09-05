import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import { encodeCode128 } from '../lib/code128';

interface Props {
  value: string;
  height?: number;
  barMinWidth?: number;
  color?: string;
}

const SCREEN_W = Dimensions.get('window').width;

export default function Barcode({
  value,
  height = 120,
  barMinWidth = 2,
  color = '#000000',
}: Props) {
  const bars = useMemo(() => {
    try {
      return encodeCode128(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!bars) return null;

  const totalUnits = bars.reduce((sum, b) => sum + b.width, 0);
  const svgWidth = SCREEN_W - 32;
  const unitPx = Math.max(barMinWidth, svgWidth / totalUnits);
  const totalWidth = totalUnits * unitPx;

  let x = 0;
  return (
    <Svg width={totalWidth} height={height}>
      <G>
        {bars.map((bar, i) => {
          const bw = bar.width * unitPx;
          const el = bar.dark ? (
            <Rect key={i} x={x} y={0} width={bw} height={height} fill={color} />
          ) : null;
          x += bw;
          return el;
        })}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({});
