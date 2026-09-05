import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import Barcode from '../components/Barcode';

interface Props {
  number: string;
  onScanAgain: () => void;
}

const SCREEN_H = Dimensions.get('window').height;

export default function BarcodeScreen({ number, onScanAgain }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({ message: number });
    } catch {}
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>SCANNED NUMBER</Text>
          <Text style={styles.numberText}>{number}</Text>
        </View>

        {/* Barcode card */}
        <View style={styles.barcodeCard}>
          <View style={styles.barcodeWrapper}>
            <Barcode value={number} height={110} barMinWidth={1.5} color="#1a1a1a" />
          </View>
          <Text style={styles.barcodeLabel}>{number}</Text>
          <Text style={styles.barcodeType}>Code 128</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareBtnText}>Share Number</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanAgainBtn}
            onPress={onScanAgain}
            activeOpacity={0.8}
          >
            <Text style={styles.scanAgainBtnText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#888',
    textTransform: 'uppercase',
  },
  numberText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  barcodeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    gap: 12,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  barcodeWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  barcodeLabel: {
    fontSize: 15,
    letterSpacing: 3,
    color: '#333',
    fontVariant: ['tabular-nums'],
  },
  barcodeType: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  shareBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scanAgainBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  scanAgainBtnText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
