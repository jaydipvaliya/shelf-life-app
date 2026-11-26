import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  X,
  ScanLine,
  Camera,
  Image as ImageIcon,
  Pencil,
  Minus,
  Plus,
  Flashlight,
  Users,
  Check,
  Sparkles,
  ListPlus,
} from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CategoryIcon } from '../ui/FoodIcon';
import { useTheme } from '../../theme/theme';
import {
  CreateItemPayload,
  FoodCategory,
  FoodLocation,
  ParsedHaulItem,
  itemsApi,
} from '../../api/items';
import { householdsApi } from '../../api/households';
import { fetchProductByBarcode } from '../../api/openFoodFacts';
import {
  CATEGORIES,
  CATEGORY_LIST,
  LOCATIONS,
  UNITS,
  getSmartDefaultExpiry,
} from '../../utils/categories';
import { formatShortDateWithWeekday, calculateDaysRemaining } from '../../utils/date';
import { CURRENCIES, formatCurrency, getCurrencySymbol } from '../../utils/currency';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type AddMode = 'scan' | 'photo' | 'manual' | 'haul';

interface HaulDraftItem extends ParsedHaulItem {
  selected: boolean;
}

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateItemPayload) => Promise<void>;
  loading?: boolean;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const { colors, spacing, radius, shadows } = useTheme();
  const { currency, setCurrency } = useAuthStore();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<AddMode>('scan');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scannedLockRef = useRef(false);

  const [name, setName] = useState('');
  const [subtitleInfo, setSubtitleInfo] = useState('');
  const [category, setCategory] = useState<FoodCategory>('produce');
  const [location, setLocation] = useState<FoodLocation>('fridge');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [priceInput, setPriceInput] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date>(
    getSmartDefaultExpiry('produce', 'fridge')
  );
  const [photoUrl, setPhotoUrl] = useState('');
  const [barcode, setBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [detectedBanner, setDetectedBanner] = useState(false);

  // Quick Haul / Receipt batch importer state
  const [haulText, setHaulText] = useState('');
  const [haulDrafts, setHaulDrafts] = useState<HaulDraftItem[]>([]);
  const [isParsingHaul, setIsParsingHaul] = useState(false);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [usedAIForHaul, setUsedAIForHaul] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => householdsApi.getHouseholds(),
    enabled: visible,
  });

  useEffect(() => {
    if (visible) {
      setMode(Platform.OS === 'web' ? 'manual' : 'scan');
      setTorchEnabled(false);
      scannedLockRef.current = false;
      setName('');
      setSubtitleInfo('');
      setCategory('produce');
      setLocation('fridge');
      setQuantity(1);
      setUnit('pcs');
      setPriceInput('');
      setExpiryDate(getSmartDefaultExpiry('produce', 'fridge'));
      setPhotoUrl('');
      setBarcode('');
      setManualBarcode('');
      setNotes('');
      setHouseholdId(null);
      setShowCategoryPicker(false);
      setShowExpiryPicker(false);
      setShowUnitPicker(false);
      setShowCurrencyPicker(false);
      setDetectedBanner(false);
      setHaulText('');
      setHaulDrafts([]);
      setUsedAIForHaul(false);
    }
  }, [visible]);

  const handleBarcodeLookup = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setBarcode(clean);
    setManualBarcode(clean);
    setIsLookingUp(true);

    try {
      const product = await fetchProductByBarcode(clean);
      if (product) {
        setName(product.name);
        setSubtitleInfo(
          [product.brand, product.quantityStr].filter(Boolean).join(' · ') ||
            `Barcode ${clean}`
        );
        setCategory(product.category);
        if (product.photoUrl) setPhotoUrl(product.photoUrl);
        setExpiryDate(getSmartDefaultExpiry(product.category, location));
        setDetectedBanner(true);
      } else {
        setSubtitleInfo(`Barcode ${clean}`);
        setDetectedBanner(true);
        Alert.alert(
          'Product Not Found',
          `Scanned barcode ${clean}, but no match was found in Open Food Facts. Enter the item name below.`
        );
      }
    } catch {
      Alert.alert('Lookup Failed', 'Unable to reach Open Food Facts right now.');
    } finally {
      setIsLookingUp(false);
      setTimeout(() => {
        scannedLockRef.current = false;
      }, 1500);
    }
  };

  const handleCameraBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scannedLockRef.current || !result?.data || isLookingUp) return;
    scannedLockRef.current = true;
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    void handleCameraLookup(result.data);
  };

  const handleCameraLookup = async (code: string) => {
    await handleBarcodeLookup(code);
  };

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${source === 'camera' ? 'camera' : 'photo library'} access in settings.`
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.75,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.75,
            });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsUploadingPhoto(true);

      const formData = new FormData();
      const fileName = asset.fileName || `item-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('photo', blob, fileName);
      } else {
        formData.append('photo', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob);
      }

      const uploadedUrl = await itemsApi.uploadPhoto(formData);
      setPhotoUrl(uploadedUrl);
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err.response?.data?.message || 'Could not upload photo.'
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCategorySelect = (cat: FoodCategory) => {
    setCategory(cat);
    setExpiryDate(getSmartDefaultExpiry(cat, location));
    setShowCategoryPicker(false);
  };

  const handleLocationSelect = (loc: FoodLocation) => {
    setLocation(loc);
    setExpiryDate(getSmartDefaultExpiry(category, loc));
  };

  const shiftExpiryDays = (delta: number) => {
    const next = new Date(expiryDate);
    next.setDate(next.getDate() + delta);
    setExpiryDate(next);
  };

  const setPresetDays = (days: number) => {
    const next = new Date();
    next.setDate(next.getDate() + days);
    setExpiryDate(next);
  };

  const handleSave = async () => {
    if (mode === 'haul') {
      const selectedItems = haulDrafts.filter((d) => d.selected);
      if (selectedItems.length === 0) {
        Alert.alert(
          'No Items Selected',
          'Paste or type your groceries and tap "Parse Groceries" first.'
        );
        return;
      }

      setIsSavingBatch(true);
      try {
        const payload = selectedItems.map((d) => ({
          name: d.name,
          category: d.category,
          location: d.location,
          quantity: d.quantity,
          unit: d.unit,
          price: d.price,
          expiryDate: d.expiryDate,
          householdId,
        }));
        const res = await itemsApi.createItemsBatch(payload, householdId);
        queryClient.invalidateQueries({ queryKey: ['items'] });
        queryClient.invalidateQueries({ queryKey: ['search-items'] });
        queryClient.invalidateQueries({ queryKey: ['items-expiring-soon'] });
        queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
        queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        Alert.alert(
          'Haul Added',
          `Added ${res.count} item${res.count === 1 ? '' : 's'} to Your Kitchen!`
        );
        onClose();
      } catch (err: any) {
        Alert.alert(
          'Batch Add Failed',
          err.response?.data?.message || 'Could not save grocery haul items.'
        );
      } finally {
        setIsSavingBatch(false);
      }
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter or scan a food item name.');
      return;
    }

    const parsedPrice = priceInput.trim() !== '' ? parseFloat(priceInput) : null;
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      Alert.alert('Invalid Price', 'Please enter a valid non-negative price.');
      return;
    }

    await onSubmit({
      name: name.trim(),
      category,
      location,
      quantity: Math.max(0.5, quantity),
      unit,
      price: parsedPrice,
      expiryDate: expiryDate.toISOString(),
      photoUrl,
      barcode,
      notes: notes.trim(),
      householdId,
    });
  };

  const handleParseHaul = async (textOverride?: string) => {
    const raw = (textOverride ?? haulText).trim();
    if (!raw) {
      Alert.alert('Enter Groceries', 'Type or paste receipt lines or items separated by commas.');
      return;
    }

    setIsParsingHaul(true);
    try {
      const parsed = await itemsApi.parseHaul(raw);
      if (parsed.length === 0) {
        Alert.alert(
          'Nothing Detected',
          'Could not detect grocery items. Try lines like "2 milk $4.50, baby spinach $2.99".'
        );
        return;
      }
      setHaulDrafts(parsed.map((item) => ({ ...item, selected: true })));
    } catch {
      Alert.alert('Parse Failed', 'Unable to parse grocery haul right now.');
    } finally {
      setIsParsingHaul(false);
    }
  };

  const handleScanBillPhoto = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${source === 'camera' ? 'camera' : 'photo library'} access to scan a shop bill.`
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.85,
            });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsScanningBill(true);

      const formData = new FormData();
      const fileName = asset.fileName || `bill-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('receipt', blob, fileName);
      } else {
        formData.append('receipt', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob);
      }

      const scanned = await itemsApi.scanReceipt(formData);
      if (scanned.rawText) {
        setHaulText(scanned.rawText);
      }

      if (scanned.items.length === 0) {
        setHaulDrafts([]);
        setUsedAIForHaul(false);
        Alert.alert(
          'No Food Items Found',
          scanned.aiConfigured
            ? 'No edible grocery or food items were detected in this bill image.'
            : 'No clear food items were detected. For full AI bill scanning on any receipt photo, add GEMINI_API_KEY in server/.env, or type items below.'
        );
        return;
      }

      setUsedAIForHaul(Boolean(scanned.usedAI));
      setHaulDrafts(scanned.items.map((item) => ({ ...item, selected: true })));
    } catch (err: any) {
      Alert.alert(
        'Bill Scan Failed',
        err.response?.data?.message || 'Could not scan that shop bill. Please try a clearer photo.'
      );
    } finally {
      setIsScanningBill(false);
    }
  };

  const toggleHaulItem = (idx: number) => {
    setHaulDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, selected: !d.selected } : d))
    );
  };

  const cycleHaulLocation = (idx: number) => {
    const order: FoodLocation[] = ['fridge', 'freezer', 'pantry'];
    setHaulDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        const nextLoc = order[(order.indexOf(d.location) + 1) % order.length];
        return {
          ...d,
          location: nextLoc,
          expiryDate: getSmartDefaultExpiry(d.category, nextLoc).toISOString(),
        };
      })
    );
  };

  const selectedHaulCount = haulDrafts.filter((d) => d.selected).length;
  const categoryInfo = CATEGORIES[category] || CATEGORIES.other;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Bar */}
          <View style={[styles.headerBar, { paddingHorizontal: spacing.lg }]}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <X size={22} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Add Item
            </Text>

            <TouchableOpacity
              onPress={() => setMode(mode === 'manual' ? 'scan' : 'manual')}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                {mode === 'manual' ? 'Scan' : 'Manual'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4-Mode Segmented Switcher: Scan | Photo | Manual | Haul */}
          <View style={[styles.modeBar, { paddingHorizontal: spacing.lg }]}>
            {(['scan', 'photo', 'manual', 'haul'] as AddMode[]).map((tab) => {
              const isSelected = mode === tab;
              const label =
                tab === 'scan'
                  ? 'Scan'
                  : tab === 'photo'
                  ? 'Photo'
                  : tab === 'manual'
                  ? 'Manual'
                  : 'Haul';
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setMode(tab)}
                  style={[
                    styles.modePill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.textInverse : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: 24,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Mode 1: Inline Barcode Camera Frame */}
            {mode === 'scan' && (
              <View style={[styles.scannerFrame, { borderRadius: radius.xl }]}>
                {Platform.OS === 'web' ? (
                  <View style={styles.scannerFallback}>
                    <ScanLine size={32} color="#8FD0A6" />
                    <Text style={styles.scannerPrompt}>
                      Enter a barcode below or switch to Manual on web
                    </Text>
                  </View>
                ) : !permission?.granted ? (
                  <View style={styles.scannerFallback}>
                    <Camera size={32} color="#8FD0A6" />
                    <Text style={styles.scannerPrompt}>
                      Allow camera access to scan grocery barcodes
                    </Text>
                    <TouchableOpacity
                      onPress={() => void requestPermission()}
                      style={[
                        styles.enableCamBtn,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        Enable Camera
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
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
                      onBarcodeScanned={handleCameraBarcodeScanned}
                    />
                    <View style={styles.scannerOverlay} pointerEvents="none">
                      <View style={[styles.bracket, styles.tl]} />
                      <View style={[styles.bracket, styles.tr]} />
                      <View style={[styles.bracket, styles.bl]} />
                      <View style={[styles.bracket, styles.br]} />
                      {isLookingUp ? (
                        <ActivityIndicator size="large" color="#8FD0A6" />
                      ) : (
                        <ScanLine size={34} color="rgba(255,255,255,0.85)" />
                      )}
                      <Text style={styles.scannerCaption}>
                        {isLookingUp
                          ? 'Looking up product...'
                          : 'Align barcode within the frame'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setTorchEnabled((p) => !p)}
                      style={[
                        styles.torchBtn,
                        torchEnabled && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Flashlight size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Mode 2: Photo Capture / Gallery */}
            {mode === 'photo' && (
              <View
                style={[
                  styles.photoPanel,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                  },
                ]}
              >
                {photoUrl ? (
                  <View style={styles.photoUploadedBox}>
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.photoUploadedImg}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setPhotoUrl('')}
                      style={[styles.removePhotoTag, { backgroundColor: colors.danger }]}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.photoButtonsRow}>
                  <Button
                    title="Take Photo"
                    variant="secondary"
                    size="sm"
                    loading={isUploadingPhoto}
                    icon={<Camera size={16} color={colors.primary} />}
                    onPress={() => void handlePickPhoto('camera')}
                    style={{ flex: 1, marginRight: spacing.sm }}
                  />
                  <Button
                    title="Gallery"
                    variant="secondary"
                    size="sm"
                    loading={isUploadingPhoto}
                    icon={<ImageIcon size={16} color={colors.primary} />}
                    onPress={() => void handlePickPhoto('library')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            {/* Mode 3: Manual Barcode Lookup */}
            {mode === 'manual' && (
              <View
                style={[
                  styles.manualBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                  },
                ]}
              >
                <Input
                  label="Barcode Lookup (Optional)"
                  placeholder="Enter barcode number (e.g. 737628064502)"
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  keyboardType="numeric"
                  containerStyle={{ marginBottom: 8 }}
                />
                <Button
                  title="Lookup Product"
                  variant="secondary"
                  size="sm"
                  loading={isLookingUp}
                  onPress={() => void handleBarcodeLookup(manualBarcode)}
                />
              </View>
            )}

            {/* Mode 4: Quick Grocery Haul / Receipt Batch Importer */}
            {mode === 'haul' && (
              <View>
                <View
                  style={[
                    styles.haulCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radius.xl,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.haulHeaderRow}>
                    <ListPlus size={18} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      Scan Shop Bill or Paste Haul
                    </Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    Snap a grocery bill photo to auto-extract items, or paste/type items below.
                  </Text>

                  {/* Scan Shop Bill Buttons */}
                  <View style={styles.billScanRow}>
                    <Button
                      title="Scan Bill"
                      variant="primary"
                      size="sm"
                      loading={isScanningBill}
                      icon={<Camera size={15} color={colors.textInverse} />}
                      onPress={() => void handleScanBillPhoto('camera')}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Bill Photo"
                      variant="secondary"
                      size="sm"
                      loading={isScanningBill}
                      icon={<ImageIcon size={15} color={colors.primary} />}
                      onPress={() => void handleScanBillPhoto('library')}
                      style={{ flex: 1 }}
                    />
                  </View>

                  {isScanningBill && (
                    <View style={styles.scanningBillBanner}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
                        Reading shop bill & extracting items...
                      </Text>
                    </View>
                  )}

                  <TextInput
                    multiline
                    numberOfLines={4}
                    placeholder={'2 milk $4.50\nBaby spinach $2.99\nSourdough bread $3.50\nChicken breast 500g $6.50'}
                    placeholderTextColor={colors.textMuted}
                    value={haulText}
                    onChangeText={setHaulText}
                    textAlignVertical="top"
                    style={[
                      styles.haulTextInput,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        color: colors.text,
                        borderRadius: radius.md,
                      },
                    ]}
                  />

                  <View style={styles.haulActionsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        const sample = '2 Whole Milk $4.50, Baby Spinach $2.99, Sourdough Bread $3.50, Chicken Breast 500g $6.80, Frozen Berries $4.20';
                        setHaulText(sample);
                        void handleParseHaul(sample);
                      }}
                      style={[
                        styles.sampleHaulChip,
                        { backgroundColor: colors.surfaceSubtle },
                      ]}
                    >
                      <Sparkles size={12} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                        Try Sample Haul
                      </Text>
                    </TouchableOpacity>

                    <Button
                      title="Parse Items"
                      size="sm"
                      loading={isParsingHaul}
                      onPress={() => void handleParseHaul()}
                    />
                  </View>
                </View>

                {haulDrafts.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <View style={styles.reviewHeaderRow}>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                        Review parsed items ({selectedHaulCount} selected)
                      </Text>
                      {usedAIForHaul && (
                        <View style={[styles.aiBadge, { backgroundColor: colors.safeBg }]}>
                          <Sparkles size={11} color={colors.safeText} style={{ marginRight: 4 }} />
                          <Text style={{ color: colors.safeText, fontSize: 11, fontWeight: '700' }}>
                            AI Extracted
                          </Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        styles.detailsCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.borderSubtle,
                          borderRadius: radius.xl,
                          ...shadows.subtle,
                        },
                      ]}
                    >
                      {haulDrafts.map((draft, idx) => {
                        const catInfo = CATEGORIES[draft.category] || CATEGORIES.other;
                        const days = calculateDaysRemaining(draft.expiryDate);
                        return (
                          <View
                            key={`${draft.name}-${idx}`}
                            style={[
                              styles.haulDraftRow,
                              idx < haulDrafts.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: colors.borderSubtle,
                              },
                              { opacity: draft.selected ? 1 : 0.45 },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => toggleHaulItem(idx)}
                              style={[
                                styles.haulCheck,
                                {
                                  backgroundColor: draft.selected
                                    ? colors.primary
                                    : colors.surfaceSubtle,
                                  borderColor: draft.selected
                                    ? colors.primary
                                    : colors.border,
                                },
                              ]}
                            >
                              {draft.selected && (
                                <Check size={12} color={colors.textInverse} />
                              )}
                            </TouchableOpacity>

                            <View
                              style={[
                                styles.haulIconBox,
                                { backgroundColor: catInfo.color + '18' },
                              ]}
                            >
                              <CategoryIcon
                                category={draft.category}
                                size={16}
                                color={catInfo.color}
                              />
                            </View>

                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text
                                style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}
                                numberOfLines={1}
                              >
                                {draft.name}
                              </Text>
                              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                                {draft.quantity} {draft.unit}
                                {draft.price !== null
                                  ? ` · ${formatCurrency(draft.price, currency)}`
                                  : ''}
                                {` · ~${days}d expiry`}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => cycleHaulLocation(idx)}
                              style={[
                                styles.haulLocPill,
                                { backgroundColor: colors.safeBg },
                              ]}
                            >
                              <Text
                                style={{
                                  color: colors.safeText,
                                  fontSize: 11,
                                  fontWeight: '700',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {draft.location}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Detected / Item Details Section (Single Item Modes) */}
            {mode !== 'haul' && (
              <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {detectedBanner ? 'Detected' : 'Item details'}
            </Text>

            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radius.xl,
                  ...shadows.subtle,
                },
              ]}
            >
              {/* Product Name & Thumbnail Row */}
              <View
                style={[
                  styles.detectedTopRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View
                  style={[
                    styles.detectedThumb,
                    {
                      backgroundColor: photoUrl
                        ? colors.surfaceSubtle
                        : categoryInfo.color + '1A',
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.thumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <CategoryIcon
                      category={category}
                      size={24}
                      color={categoryInfo.color}
                    />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TextInput
                    placeholder="Enter food name (e.g. Baby Spinach)"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    style={[styles.nameInput, { color: colors.text }]}
                  />
                  {subtitleInfo ? (
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {subtitleInfo}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Row 1: Category */}
              <TouchableOpacity
                onPress={() => setShowCategoryPicker((p) => !p)}
                style={[styles.kvRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                  Category
                </Text>
                <View style={styles.kvValueRow}>
                  <Text style={[styles.kvValue, { color: colors.text }]}>
                    {categoryInfo.name}
                  </Text>
                  <Pencil size={13} color={colors.textMuted} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              {showCategoryPicker && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.inlineChipScroll}
                >
                  {CATEGORY_LIST.map((cat) => {
                    const isSel = category === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => handleCategorySelect(cat.id)}
                        style={[
                          styles.inlineChip,
                          {
                            backgroundColor: isSel
                              ? colors.primary
                              : colors.surfaceSubtle,
                            borderRadius: radius.full,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? colors.textInverse : colors.text,
                            fontSize: 12,
                            fontWeight: isSel ? '700' : '500',
                          }}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Row 2: Storage Location Pills */}
              <View style={[styles.kvRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                  Storage
                </Text>
                <View style={styles.storagePillsRow}>
                  {LOCATIONS.map((loc) => {
                    const isSel = location === loc.id;
                    return (
                      <TouchableOpacity
                        key={loc.id}
                        onPress={() => handleLocationSelect(loc.id)}
                        style={[
                          styles.storagePill,
                          {
                            backgroundColor: isSel
                              ? colors.safeBg
                              : colors.surfaceSubtle,
                            borderColor: isSel ? colors.safeBorder : 'transparent',
                            borderRadius: radius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? colors.safeText : colors.textSecondary,
                            fontWeight: isSel ? '700' : '500',
                            fontSize: 12,
                          }}
                        >
                          {loc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Row 3: Expires */}
              <TouchableOpacity
                onPress={() => setShowExpiryPicker((p) => !p)}
                style={[styles.kvRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                  Expires
                </Text>
                <View style={styles.kvValueRow}>
                  <Text style={[styles.kvValue, { color: colors.text }]}>
                    {formatShortDateWithWeekday(expiryDate.toISOString())}
                  </Text>
                  <Pencil size={13} color={colors.textMuted} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              {showExpiryPicker && (
                <View style={styles.expiryControlsBox}>
                  <View style={styles.expiryStepperRow}>
                    <TouchableOpacity
                      onPress={() => shiftExpiryDays(-1)}
                      style={[
                        styles.miniStepBtn,
                        { backgroundColor: colors.surfaceSubtle },
                      ]}
                    >
                      <Minus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      Adjust day
                    </Text>
                    <TouchableOpacity
                      onPress={() => shiftExpiryDays(1)}
                      style={[
                        styles.miniStepBtn,
                        { backgroundColor: colors.surfaceSubtle },
                      ]}
                    >
                      <Plus size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.presetWrap}>
                    {[
                      { label: '+3d', days: 3 },
                      { label: '+1w', days: 7 },
                      { label: '+2w', days: 14 },
                      { label: '+1m', days: 30 },
                    ].map((p) => (
                      <TouchableOpacity
                        key={p.label}
                        onPress={() => setPresetDays(p.days)}
                        style={[
                          styles.presetChip,
                          { backgroundColor: colors.surfaceSubtle },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Row 4: Quantity Stepper */}
              <View
                style={[
                  styles.kvRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                  Quantity
                </Text>
                <View style={styles.qtyStepperRow}>
                  <TouchableOpacity
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={[
                      styles.qtyBtn,
                      { backgroundColor: colors.surfaceSubtle },
                    ]}
                  >
                    <Minus size={14} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setShowUnitPicker((p) => !p)}>
                    <Text style={[styles.qtyText, { color: colors.text }]}>
                      {quantity} {unit}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuantity((q) => q + 1)}
                    style={[
                      styles.qtyBtn,
                      { backgroundColor: colors.surfaceSubtle },
                    ]}
                  >
                    <Plus size={14} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {showUnitPicker && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.inlineChipScroll}
                >
                  {UNITS.map((u) => {
                    const isSel = unit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        onPress={() => {
                          setUnit(u);
                          setShowUnitPicker(false);
                        }}
                        style={[
                          styles.inlineChip,
                          {
                            backgroundColor: isSel
                              ? colors.primary
                              : colors.surfaceSubtle,
                            borderRadius: radius.full,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? colors.textInverse : colors.text,
                            fontSize: 12,
                            fontWeight: isSel ? '700' : '500',
                          }}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Row 5: Price Input with Currency Selector */}
              <View
                style={[
                  styles.kvRow,
                  households.length > 0 || showCurrencyPicker
                    ? { borderBottomColor: colors.borderSubtle }
                    : { borderBottomWidth: 0 },
                ]}
              >
                <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                  Price (Optional)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setShowCurrencyPicker((p) => !p)}
                    style={[
                      styles.currencySelectBtn,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {currency} ({getCurrencySymbol(currency)})
                    </Text>
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.priceInputWrap,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
                      {getCurrencySymbol(currency)}
                    </Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      value={priceInput}
                      onChangeText={setPriceInput}
                      keyboardType="decimal-pad"
                      style={[styles.priceInput, { color: colors.text }]}
                    />
                  </View>
                </View>
              </View>

              {showCurrencyPicker && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.inlineChipScroll}
                >
                  {CURRENCIES.map((c) => {
                    const isSel = currency === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => {
                          setCurrency(c.code);
                          setShowCurrencyPicker(false);
                        }}
                        style={[
                          styles.inlineChip,
                          {
                            backgroundColor: isSel
                              ? colors.primary
                              : colors.surfaceSubtle,
                            borderRadius: radius.full,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? colors.textInverse : colors.text,
                            fontSize: 12,
                            fontWeight: isSel ? '700' : '500',
                          }}
                        >
                          {c.symbol} {c.code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Optional Shared Household Row */}
              {households.length > 0 && (
                <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>
                    Pantry
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    <TouchableOpacity
                      onPress={() => setHouseholdId(null)}
                      style={[
                        styles.storagePill,
                        {
                          backgroundColor:
                            householdId === null ? colors.safeBg : colors.surfaceSubtle,
                          borderRadius: radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            householdId === null ? colors.safeText : colors.textSecondary,
                          fontSize: 12,
                          fontWeight: householdId === null ? '700' : '500',
                        }}
                      >
                        Personal
                      </Text>
                    </TouchableOpacity>
                    {households.map((hh) => {
                      const isSel = householdId === hh._id;
                      return (
                        <TouchableOpacity
                          key={hh._id}
                          onPress={() => setHouseholdId(hh._id)}
                          style={[
                            styles.storagePill,
                            {
                              backgroundColor: isSel
                                ? colors.safeBg
                                : colors.surfaceSubtle,
                              borderRadius: radius.sm,
                              flexDirection: 'row',
                              alignItems: 'center',
                            },
                          ]}
                        >
                          <Users
                            size={11}
                            color={isSel ? colors.safeText : colors.textSecondary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={{
                              color: isSel ? colors.safeText : colors.textSecondary,
                              fontSize: 12,
                              fontWeight: isSel ? '700' : '500',
                            }}
                          >
                            {hh.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
              </>
            )}
          </ScrollView>

          {/* Sticky Bottom CTA */}
          <View
            style={[
              styles.footerBar,
              {
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
                paddingTop: spacing.sm,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Button
              title={
                mode === 'haul'
                  ? `Add ${selectedHaulCount} Item${selectedHaulCount === 1 ? '' : 's'} to Kitchen`
                  : 'Add to Kitchen'
              }
              variant="primary"
              size="lg"
              loading={mode === 'haul' ? isSavingBatch : loading}
              disabled={mode === 'haul' && selectedHaulCount === 0}
              onPress={() => void handleSave()}
              fullWidth
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modeBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modePill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
  scannerFrame: {
    height: 225,
    backgroundColor: '#111613',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  scannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scannerPrompt: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  enableCamBtn: {
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracket: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
  scannerCaption: {
    position: 'absolute',
    bottom: 6,
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  torchBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPanel: {
    borderWidth: 1,
    marginBottom: 16,
  },
  photoUploadedBox: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  photoUploadedImg: {
    width: '100%',
    height: '100%',
  },
  removePhotoTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  photoButtonsRow: {
    flexDirection: 'row',
  },
  manualBox: {
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailsCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  detectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  detectedThumb: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 2,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  kvLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  kvValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineChipScroll: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  inlineChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  storagePillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  storagePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  expiryControlsBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  expiryStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  qtyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'center',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 92,
  },
  currencySelectBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  haulCard: {
    borderWidth: 1,
  },
  haulHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billScanRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  scanningBillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  haulTextInput: {
    borderWidth: 1,
    minHeight: 100,
    padding: 12,
    fontSize: 13,
    marginTop: 10,
    marginBottom: 10,
  },
  haulActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sampleHaulChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  haulDraftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  haulCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  haulIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haulLocPill: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginLeft: 8,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  priceInput: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 58,
    textAlign: 'right',
    paddingVertical: 2,
  },
  footerBar: {},
});
