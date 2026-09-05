import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ScannerScreen from './src/screens/ScannerScreen';
import BarcodeScreen from './src/screens/BarcodeScreen';

type AppScreen = 'scanner' | 'barcode';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('scanner');
  const [scannedNumber, setScannedNumber] = useState<string>('');

  const handleConfirmed = useCallback((number: string) => {
    setScannedNumber(number);
    setScreen('barcode');
  }, []);

  const handleScanAgain = useCallback(() => {
    setScannedNumber('');
    setScreen('scanner');
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'scanner' ? (
        <ScannerScreen onConfirmed={handleConfirmed} />
      ) : (
        <BarcodeScreen number={scannedNumber} onScanAgain={handleScanAgain} />
      )}
    </SafeAreaProvider>
  );
}
