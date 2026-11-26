import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { X, Flashlight, Camera, ScanLine } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { useTheme } from '../../theme/theme';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
}) => {
  const { colors, radius } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scannedLockRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedLockRef.current = false;
      setTorchEnabled(false);
    }
  }, [visible]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scannedLockRef.current || !result?.data) return;
    scannedLockRef.current = true;

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    onScanned(result.data);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconCircle}
            accessibilityLabel="Close scanner"
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Scan Food Barcode</Text>

          {permission?.granted ? (
            <TouchableOpacity
              onPress={() => setTorchEnabled((prev) => !prev)}
              style={[
                styles.iconCircle,
                torchEnabled && { backgroundColor: colors.primary },
              ]}
              accessibilityLabel="Toggle flashlight"
            >
              <Flashlight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 42 }} />
          )}
        </View>

        {/* Camera / Permission Body */}
        {!permission ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Checking camera permission...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <View style={[styles.permIconCircle, { backgroundColor: colors.primary + '25' }]}>
              <Camera size={36} color={colors.accent} />
            </View>
            <Text style={styles.permTitle}>Camera Access Needed</Text>
            <Text style={styles.permSubtitle}>
              Allow Shelf Life to use your camera to scan grocery barcodes and fill in product details automatically.
            </Text>
            <Button
              title="Enable Camera"
              variant="primary"
              size="lg"
              onPress={() => void requestPermission()}
              style={{ marginTop: 20, minWidth: 200 }}
            />
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>
                Enter Barcode Manually Instead
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'qr',
                ],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Viewfinder Overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.dimTop} />
              <View style={styles.middleRow}>
                <View style={styles.dimSide} />
                <View style={[styles.scanBox, { borderRadius: radius.lg }]}>
                  <View style={[styles.corner, styles.topLeft, { borderColor: colors.accent }]} />
                  <View style={[styles.corner, styles.topRight, { borderColor: colors.accent }]} />
                  <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.accent }]} />
                  <View style={[styles.corner, styles.bottomRight, { borderColor: colors.accent }]} />
                  <ScanLine size={28} color={colors.accent} style={{ opacity: 0.75 }} />
                </View>
                <View style={styles.dimSide} />
              </View>
              <View style={styles.dimBottom}>
                <Text style={styles.instructionTitle}>
                  Point camera at product barcode
                </Text>
                <Text style={styles.instructionSubtitle}>
                  Supports EAN, UPC, and packaged grocery barcodes
                </Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const BOX_SIZE = 250;
const CORNER_SIZE = 28;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  permTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permSubtitle: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionText: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dimTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: BOX_SIZE,
  },
  dimSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 12,
  },
  dimBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  instructionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
