import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// The scanning window dimensions
export const VIEWFINDER_W = SCREEN_W * 0.85;
export const VIEWFINDER_H = SCREEN_H * 0.12; // wide, short — like a credit card number row
export const VIEWFINDER_X = (SCREEN_W - VIEWFINDER_W) / 2;
export const VIEWFINDER_Y = SCREEN_H / 2 - VIEWFINDER_H / 2;

interface Props {
  scanning: boolean;
  confirmed: boolean;
}

export default function ViewfinderOverlay({ scanning, confirmed }: Props) {
  const laserY = useSharedValue(0);

  React.useEffect(() => {
    if (scanning && !confirmed) {
      laserY.value = 0;
      laserY.value = withRepeat(
        withTiming(VIEWFINDER_H - 2, {
          duration: 800,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    } else {
      laserY.value = 0;
    }
  }, [scanning, confirmed]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
    opacity: scanning && !confirmed ? 1 : 0,
  }));

  const cornerColor = confirmed ? '#00e676' : '#ffffff';
  const borderColor = confirmed ? '#00e676' : 'rgba(255,255,255,0.6)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dark overlay — top */}
      <View style={[styles.overlay, { height: VIEWFINDER_Y }]} />

      {/* Middle row */}
      <View style={styles.middleRow}>
        {/* Left dark */}
        <View style={[styles.overlay, { width: VIEWFINDER_X }]} />

        {/* Viewfinder window */}
        <View
          style={[
            styles.viewfinder,
            {
              width: VIEWFINDER_W,
              height: VIEWFINDER_H,
              borderColor,
            },
          ]}
        >
          {/* Corner marks */}
          {[
            { top: -1, left: -1 },
            { top: -1, right: -1 },
            { bottom: -1, left: -1 },
            { bottom: -1, right: -1 },
          ].map((pos, i) => (
            <View
              key={i}
              style={[
                styles.corner,
                pos,
                { borderColor: cornerColor },
                i < 2 ? styles.cornerTop : styles.cornerBottom,
                i % 2 === 0 ? styles.cornerLeft : styles.cornerRight,
              ]}
            />
          ))}

          {/* Scanning laser */}
          <Animated.View style={[styles.laser, laserStyle]} />
        </View>

        {/* Right dark */}
        <View style={[styles.overlay, { flex: 1 }]} />
      </View>

      {/* Dark overlay — bottom */}
      <View style={[styles.overlay, { flex: 1 }]} />
    </View>
  );
}

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_H,
  },
  viewfinder: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTop: {
    borderTopWidth: CORNER_THICKNESS,
  },
  cornerBottom: {
    borderBottomWidth: CORNER_THICKNESS,
  },
  cornerLeft: {
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerRight: {
    borderRightWidth: CORNER_THICKNESS,
  },
  laser: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ff3d3d',
    shadowColor: '#ff3d3d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
});
