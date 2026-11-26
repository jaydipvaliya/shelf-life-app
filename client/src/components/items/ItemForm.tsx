import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Barcode,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Minus,
  Plus,
  Users,
  ScanLine,
  Keyboard,
} from 'lucide-react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CategoryIcon, LocationIcon } from '../ui/FoodIcon';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { getCurrencySymbol } from '../../utils/currency';
import {
  CreateItemPayload,
  FoodCategory,
  FoodItem,
  FoodLocation,
  itemsApi,
} from '../../api/items';
import { householdsApi } from '../../api/households';
import {
  CATEGORIES,
  CATEGORY_LIST,
  LOCATIONS,
  UNITS,
  getSmartDefaultExpiry,
} from '../../utils/categories';
import { fetchProductByBarcode } from '../../api/openFoodFacts';
import { formatDateDisplay } from '../../utils/date';
import { useQuery } from '@tanstack/react-query';

interface ItemFormProps {
  initialItem?: FoodItem;
  onSubmit: (data: CreateItemPayload) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const ItemForm: React.FC<ItemFormProps> = ({
  initialItem,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const currency = useAuthStore((state) => state.currency);

  const [name, setName] = useState(initialItem?.name || '');
  const [category, setCategory] = useState<FoodCategory>(
    initialItem?.category || 'produce'
  );
  const [location, setLocation] = useState<FoodLocation>(
    initialItem?.location || 'fridge'
  );
  const [quantity, setQuantity] = useState(
    initialItem?.quantity ? String(initialItem.quantity) : '1'
  );
  const [unit, setUnit] = useState(initialItem?.unit || 'pcs');
  const [priceInput, setPriceInput] = useState(
    initialItem?.price !== undefined && initialItem?.price !== null
      ? String(initialItem.price)
      : ''
  );

  // Initial expiry date
  const defaultDate = initialItem
    ? new Date(initialItem.expiryDate)
    : getSmartDefaultExpiry(category, location);
  const [expiryDate, setExpiryDate] = useState<Date>(defaultDate);

  const [photoUrl, setPhotoUrl] = useState(initialItem?.photoUrl || '');
  const [photoPreviewError, setPhotoPreviewError] = useState(false);
  const [barcode, setBarcode] = useState(initialItem?.barcode || '');
  const [notes, setNotes] = useState(initialItem?.notes || '');
  const [householdId, setHouseholdId] = useState<string | null>(
    initialItem?.householdId?._id || null
  );

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => householdsApi.getHouseholds(),
  });

  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [barcodeInputVisible, setBarcodeInputVisible] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  // When category changes, suggest updated smart expiry if user hasn't explicitly customized
  const handleCategorySelect = (cat: FoodCategory) => {
    setCategory(cat);
    if (!initialItem) {
      setExpiryDate(getSmartDefaultExpiry(cat, location));
    }
  };

  const handleLocationSelect = (loc: FoodLocation) => {
    setLocation(loc);
    if (!initialItem) {
      setExpiryDate(getSmartDefaultExpiry(category, loc));
    }
  };

  // Quick Expiry Offset buttons (from today) & relative stepper (from current expiryDate)
  const addDaysToExpiry = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpiryDate(d);
  };

  const shiftExpiryByDays = (delta: number) => {
    const d = new Date(expiryDate);
    d.setDate(d.getDate() + delta);
    setExpiryDate(d);
  };

  // Barcode lookup handler
  const handleBarcodeSearch = async (codeToLookup: string) => {
    const cleanCode = codeToLookup.trim();
    if (!cleanCode) return;
    setBarcode(cleanCode);
    setManualBarcode(cleanCode);
    setIsLookingUpBarcode(true);
    try {
      const product = await fetchProductByBarcode(cleanCode);
      if (product) {
        setName(product.name);
        setCategory(product.category);
        if (product.photoUrl) {
          setPhotoUrl(product.photoUrl);
          setPhotoPreviewError(false);
        }
        setBarcode(product.barcode);
        setExpiryDate(getSmartDefaultExpiry(product.category, location));
        setBarcodeInputVisible(false);
      } else {
        Alert.alert(
          'Product Not Found',
          `Scanned barcode ${cleanCode}, but no match was found in Open Food Facts. You can enter the item name manually.`
        );
      }
    } catch {
      Alert.alert('Lookup Failed', 'Unable to reach Open Food Facts right now.');
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    setScannerVisible(false);
    void handleBarcodeSearch(scannedCode);
  };

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${source === 'camera' ? 'camera' : 'photo library'} access in device settings.`
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

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      setIsUploadingPhoto(true);

      const formData = new FormData();
      const fileName = asset.fileName || `item-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
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
        err.response?.data?.message || 'Could not upload photo. Please try again.'
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for the food item.');
      return;
    }

    const parsedQty = parseFloat(quantity) || 1;
    const parsedPrice = priceInput.trim() !== '' ? parseFloat(priceInput) : null;
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      Alert.alert('Invalid Price', 'Please enter a valid non-negative price.');
      return;
    }

    const payload: CreateItemPayload = {
      name: name.trim(),
      category,
      location,
      quantity: parsedQty,
      unit,
      price: parsedPrice,
      expiryDate: expiryDate.toISOString(),
      photoUrl,
      barcode,
      notes: notes.trim(),
      householdId,
    };

    await onSubmit(payload);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Barcode Quick Scan / Input Bar */}
      <View
        style={[
          styles.barcodeStrip,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.barcodeLeft}>
          {isLookingUpBarcode ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Barcode size={20} color={colors.primary} />
          )}
          <Text
            style={[
              styles.barcodePrompt,
              { color: colors.text, fontSize: typography.fontSize.sm },
            ]}
            numberOfLines={1}
          >
            {isLookingUpBarcode
              ? 'Looking up product...'
              : barcode
              ? `Barcode: ${barcode}`
              : 'Packaged item?'}
          </Text>
        </View>

        <View style={styles.barcodeActions}>
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={[
              styles.scanButton,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.sm,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
          >
            <ScanLine size={14} color={colors.textInverse} style={{ marginRight: 5 }} />
            <Text style={[styles.scanButtonText, { color: colors.textInverse }]}>
              Scan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setBarcodeInputVisible(!barcodeInputVisible)}
            style={[
              styles.typeButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.sm,
              },
            ]}
            accessibilityLabel="Type barcode manually"
          >
            <Keyboard size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barcode Input Expandable Box */}
      {barcodeInputVisible && (
        <View
          style={[
            styles.barcodeLookupBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: radius.md,
            },
          ]}
        >
          <Input
            placeholder="Enter barcode (e.g. 737628064502)"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
            containerStyle={{ marginBottom: 8 }}
            rightIcon={
              isLookingUpBarcode ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : undefined
            }
          />
          <View style={styles.barcodeButtonRow}>
            {/* Common demo barcode quick-fill for fast testing (dev only) */}
            {__DEV__ ? (
              <TouchableOpacity
                onPress={() => {
                  setManualBarcode('737628064502'); // Thai peanut noodles
                  handleBarcodeSearch('737628064502');
                }}
                style={[
                  styles.quickBarcodeChip,
                  { backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <Sparkles size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                  Try Sample Barcode
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <Button
              title="Search Product"
              size="sm"
              loading={isLookingUpBarcode}
              onPress={() => handleBarcodeSearch(manualBarcode)}
            />
          </View>
        </View>
      )}

      {/* Item Name Input */}
      <Input
        label="Item Name *"
        placeholder="e.g. Organic Oat Milk, Greek Yogurt..."
        value={name}
        onChangeText={setName}
        containerStyle={{ marginTop: spacing.md }}
      />

      {/* Location Picker */}
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.text, fontSize: typography.fontSize.sm },
        ]}
      >
        Storage Location *
      </Text>
      <View style={styles.locationSelectorRow}>
        {LOCATIONS.map((loc) => {
          const isSelected = location === loc.id;
          return (
            <TouchableOpacity
              key={loc.id}
              onPress={() => handleLocationSelect(loc.id)}
              style={[
                styles.locationOption,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <View style={{ marginRight: 6 }}>
                <LocationIcon
                  location={loc.id}
                  size={15}
                  color={isSelected ? colors.textInverse : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.locationOptionText,
                  {
                    color: isSelected ? colors.textInverse : colors.text,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {loc.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Horizontal Chips */}
      <Text
        style={[
          styles.fieldLabel,
          {
            color: colors.text,
            fontSize: typography.fontSize.sm,
            marginTop: spacing.md,
          },
        ]}
      >
        Category *
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {CATEGORY_LIST.map((cat) => {
          const isSelected = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => handleCategorySelect(cat.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <View style={{ marginRight: 6 }}>
                <CategoryIcon
                  category={cat.id}
                  size={14}
                  color={isSelected ? colors.textInverse : cat.color}
                />
              </View>
              <Text
                style={{
                  color: isSelected ? colors.textInverse : colors.text,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 13,
                }}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Quantity & Unit Row */}
      <View style={styles.quantityRow}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Input
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={{ width: 120 }}>
          <Text
            style={[
              styles.fieldLabel,
              {
                color: colors.text,
                fontSize: typography.fontSize.sm,
                marginBottom: spacing.xs,
              },
            ]}
          >
            Unit
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
              styles.unitScroll,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radius.md,
                borderColor: colors.border,
              },
            ]}
          >
            {UNITS.map((u) => {
              const isSelected = unit === u;
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[
                    styles.unitChip,
                    {
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.textInverse : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 12,
                    }}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Expiry Date Section with Stepper & Presets */}
      <Input
        label={`Price (Optional, ${getCurrencySymbol(currency)})`}
        placeholder="e.g. 4.99"
        value={priceInput}
        onChangeText={setPriceInput}
        keyboardType="decimal-pad"
        containerStyle={{ marginTop: spacing.xs }}
      />

      <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
        <View style={styles.expiryHeaderRow}>
          <Text
            style={[
              styles.fieldLabel,
              { color: colors.text, fontSize: typography.fontSize.sm, marginBottom: 0 },
            ]}
          >
            Expiry Date:{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {formatDateDisplay(expiryDate.toISOString())}
            </Text>
          </Text>

          <View style={styles.stepperRow}>
            <TouchableOpacity
              onPress={() => shiftExpiryByDays(-1)}
              style={[
                styles.stepperBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
              accessibilityLabel="Subtract one day"
            >
              <Minus size={14} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => shiftExpiryByDays(1)}
              style={[
                styles.stepperBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
              accessibilityLabel="Add one day"
            >
              <Plus size={14} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickPresetsRow}>
          {[
            { label: '+3 Days', days: 3 },
            { label: '+1 Week', days: 7 },
            { label: '+2 Weeks', days: 14 },
            { label: '+1 Month', days: 30 },
            { label: '+3 Months', days: 90 },
          ].map((preset) => (
            <TouchableOpacity
              key={preset.label}
              onPress={() => addDaysToExpiry(preset.days)}
              style={[
                styles.presetButton,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textSecondary,
                  fontWeight: '600',
                }}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Shared Household Selector (if member of at least one household) */}
      {households.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={[
              styles.fieldLabel,
              { color: colors.text, fontSize: typography.fontSize.sm },
            ]}
          >
            Pantry Scope
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setHouseholdId(null)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: householdId === null ? colors.primary : colors.surfaceSubtle,
                  borderColor: householdId === null ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                style={{
                  color: householdId === null ? colors.textInverse : colors.text,
                  fontWeight: householdId === null ? '700' : '500',
                  fontSize: 13,
                }}
              >
                Personal Only
              </Text>
            </TouchableOpacity>

            {households.map((hh) => {
              const isSelected = householdId === hh._id;
              return (
                <TouchableOpacity
                  key={hh._id}
                  onPress={() => setHouseholdId(hh._id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <View style={{ marginRight: 5 }}>
                    <Users
                      size={13}
                      color={isSelected ? colors.textInverse : colors.primary}
                    />
                  </View>
                  <Text
                    style={{
                      color: isSelected ? colors.textInverse : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 13,
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

      {/* Photo Picker & URL */}
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.text, fontSize: typography.fontSize.sm },
        ]}
      >
        Item Photo (Optional)
      </Text>
      <View style={styles.photoActionRow}>
        <Button
          title="Take Photo"
          variant="secondary"
          size="sm"
          loading={isUploadingPhoto}
          icon={<Camera size={16} color={colors.primary} />}
          onPress={() => handlePickPhoto('camera')}
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          title="Gallery"
          variant="secondary"
          size="sm"
          loading={isUploadingPhoto}
          icon={<ImageIcon size={16} color={colors.primary} />}
          onPress={() => handlePickPhoto('library')}
          style={{ flex: 1 }}
        />
      </View>

      <Input
        label="Photo URL (Optional)"
        placeholder="https://images.unsplash.com/..."
        value={photoUrl}
        onChangeText={(text) => {
          setPhotoUrl(text);
          if (photoPreviewError) setPhotoPreviewError(false);
        }}
        helperText="Upload a photo above, paste a URL, or use barcode lookup"
      />

      {photoUrl ? (
        <View
          style={[
            styles.photoPreviewBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radius.md,
              borderColor: colors.border,
            },
          ]}
        >
          {photoPreviewError ? (
            <View style={styles.photoFallbackBox}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Preview unavailable for this URL
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: photoUrl }}
              style={styles.photoPreview}
              resizeMode="cover"
              onError={() => setPhotoPreviewError(true)}
            />
          )}
          <TouchableOpacity
            onPress={() => {
              setPhotoUrl('');
              setPhotoPreviewError(false);
            }}
            style={[
              styles.removePhotoBtn,
              { backgroundColor: colors.danger },
            ]}
          >
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Notes */}
      <Input
        label="Notes (Optional)"
        placeholder="e.g. Opened on Tuesday, keep frozen once thawed..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={2}
        containerStyle={{ marginTop: spacing.sm }}
      />

      {/* Form Action Buttons */}
      <View style={styles.formActionsRow}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={onCancel}
          style={{ flex: 1, marginRight: spacing.md }}
        />
        <Button
          title={initialItem ? 'Save Changes' : 'Add to Shelf'}
          variant="primary"
          loading={loading}
          onPress={handleSubmit}
          style={{ flex: 1.5 }}
        />
      </View>
      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  barcodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  barcodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  barcodePrompt: {
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  barcodeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  typeButton: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  barcodeLookupBox: {
    borderWidth: 1.5,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  barcodeButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickBarcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  locationSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  locationOptionText: {
    fontSize: 13,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unitScroll: {
    borderWidth: 1,
    padding: 3,
    maxHeight: 46,
  },
  unitChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 2,
  },
  expiryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  presetButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  photoActionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  photoPreviewBox: {
    height: 140,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoFallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  formActionsRow: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 20,
  },
});
