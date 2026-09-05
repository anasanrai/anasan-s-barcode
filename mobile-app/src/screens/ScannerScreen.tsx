import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  AppState,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import ViewfinderOverlay, {
  VIEWFINDER_W,
  VIEWFINDER_H,
  VIEWFINDER_X,
  VIEWFINDER_Y,
} from '../components/ViewfinderOverlay';
import { extractNumber, updateCandidate, NumericCandidate } from '../lib/numericExtract';

// ─── Tuning constants ────────────────────────────────────────────────────────
const CAPTURE_INTERVAL_MS = 150; // target ~6-7 fps of OCR
const MIN_SHARPNESS_THRESHOLD = 0; // always process (sharpness check not available in expo-camera)

interface Props {
  onConfirmed: (number: string) => void;
}

export default function ScannerScreen({ onConfirmed }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [hint, setHint] = useState('Point at the number');

  // Candidate tracking (mutable ref to avoid stale closure in interval)
  const candidateRef = useRef<NumericCandidate | null>(null);
  const isCapturingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Camera ready ──────────────────────────────────────────────────────────
  const startScanning = useCallback(() => {
    if (intervalRef.current) return;
    setScanning(true);
    intervalRef.current = setInterval(captureAndOcr, CAPTURE_INTERVAL_MS);
  }, []);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setScanning(false);
  }, []);

  // ─── Core capture + OCR loop ───────────────────────────────────────────────
  const captureAndOcr = useCallback(async () => {
    if (isCapturingRef.current || !cameraRef.current) return;
    isCapturingRef.current = true;

    try {
      // Capture a low-quality JPEG (fast) — no base64, just a file URI
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.15,        // very low quality — fine for OCR
        skipProcessing: true, // skip EXIF/rotation correction for speed
        shutterSound: false,
      });

      if (!pic?.uri) return;

      // ML Kit text recognition — runs entirely on-device, <100ms
      const result = await TextRecognition.recognize(pic.uri);

      // Concatenate all detected text blocks
      const fullText = result.blocks.map((b) => b.text).join('\n');
      const observed = extractNumber(fullText);

      // Update temporal tracker
      const { candidate, confirmed: confirmedValue } = updateCandidate(
        candidateRef.current,
        observed,
      );
      candidateRef.current = candidate;

      if (observed) {
        setHint(`Detected: ${observed}`);
      } else {
        setHint('Point at the number');
      }

      if (confirmedValue) {
        stopScanning();
        setConfirmed(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Small delay for the green flash to register, then transition
        setTimeout(() => onConfirmed(confirmedValue), 300);
      }
    } catch (err) {
      // Swallow individual frame errors — next frame will retry
    } finally {
      isCapturingRef.current = false;
    }
  }, [onConfirmed, stopScanning]);

  // ─── App state — pause when backgrounded ─────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopScanning();
    });
    return () => sub.remove();
  }, [stopScanning]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  // ─── Permission handling ───────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is required</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        zoom={0}
        onCameraReady={startScanning}
      />

      <ViewfinderOverlay scanning={scanning} confirmed={confirmed} />

      {/* Status hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>{hint}</Text>
      </View>

      {/* App title */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Anasan Barcode</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionBtn: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  titleContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
