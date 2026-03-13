import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import {
  createProperty,
  fetchPropertyById,
  PropertyFormError,
  type PropertyFormInput,
  type PropertyOperationMode,
  type PropertyStatus,
  updatePropertyForm,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyEditorRoute = RouteProp<ManagerStackParamList, "PropertyEditor">;
type PropertyEditorNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyEditor">;

type FormField =
  | "title"
  | "description"
  | "address"
  | "city"
  | "postalCode"
  | "status"
  | "propertyType"
  | "operationMode"
  | "salePrice"
  | "rentalPrice"
  | "garagePriceCategoryId"
  | "garagePrice"
  | "bedrooms"
  | "bathrooms"
  | "rooms"
  | "elevator";

type FieldErrors = Partial<Record<FormField, string>>;

const statusOptions: PropertyStatus[] = ["available", "reserved", "maintenance"];
const operationModeOptions: PropertyOperationMode[] = ["sale", "rent", "both"];
const propertyTypeOptions = [
  "apartment",
  "house",
  "chalet",
  "duplex",
  "studio",
  "penthouse",
  "office",
  "commercial",
];
const garageCategoryOptions = [
  { id: "1", label: "Standard" },
  { id: "2", label: "Premium" },
];
const residentialPropertyTypes = new Set([
  "apartment",
  "house",
  "chalet",
  "duplex",
  "studio",
  "penthouse",
  "residential",
]);

function firstError(fieldErrors: Record<string, string[]> | undefined, key: string): string | undefined {
  if (!fieldErrors) {
    return undefined;
  }
  const values = fieldErrors[key];
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  return String(values[0]);
}

function isIntegerString(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveCanonicalPrice(
  operationMode: PropertyOperationMode | "",
  salePrice: number | null,
  rentalPrice: number | null,
  garagePrice: number | null
): number | null {
  if (operationMode === "sale") {
    return salePrice ?? garagePrice ?? null;
  }
  if (operationMode === "rent") {
    return rentalPrice ?? garagePrice ?? null;
  }
  return salePrice ?? rentalPrice ?? garagePrice ?? null;
}

const PropertyEditorScreen = () => {
  const navigation = useNavigation<PropertyEditorNavigation>();
  const route = useRoute<PropertyEditorRoute>();
  const isEditMode = route.params.mode === "edit";
  const propertyId = route.params.mode === "edit" ? route.params.propertyId : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [status, setStatus] = useState<PropertyStatus>("available");
  const [propertyType, setPropertyType] = useState(isEditMode ? "" : "apartment");
  const [operationMode, setOperationMode] = useState<PropertyOperationMode | "">(
    isEditMode ? "" : "sale"
  );
  const [salePrice, setSalePrice] = useState("");
  const [rentalPrice, setRentalPrice] = useState("");
  const [garagePriceCategoryId, setGaragePriceCategoryId] = useState<string | null>(null);
  const [garagePrice, setGaragePrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rooms, setRooms] = useState("");
  const [elevator, setElevator] = useState<boolean | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const headerTitle = useMemo(
    () => (isEditMode ? "Edit Property Form" : "Create Property Form"),
    [isEditMode]
  );
  const isResidential = residentialPropertyTypes.has(propertyType);

  useEffect(() => {
    navigation.setOptions({ title: headerTitle });
  }, [headerTitle, navigation]);

  const clearFieldError = useCallback((field: FormField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  const loadProperty = useCallback(async () => {
    if (!isEditMode || !propertyId) {
      return;
    }

    setLoadingInitial(true);
    setFormError(null);
    try {
      const property = await fetchPropertyById(propertyId);
      setTitle(property.title);
      setDescription(property.description ?? "");
      setAddress(property.address ?? "");
      setCity(property.city);
      setPostalCode(property.postalCode ?? "");
      setStatus(property.status);
      setPropertyType(property.propertyType ?? "");
      setOperationMode(property.operationMode ?? "");
      setSalePrice(
        typeof property.pricing.salePrice === "number" ? String(property.pricing.salePrice) : ""
      );
      setRentalPrice(
        typeof property.pricing.rentalPrice === "number" ? String(property.pricing.rentalPrice) : ""
      );
      setGaragePriceCategoryId(
        property.pricing.garagePriceCategoryId !== null
          ? String(property.pricing.garagePriceCategoryId)
          : null
      );
      setGaragePrice(
        typeof property.pricing.garagePrice === "number" ? String(property.pricing.garagePrice) : ""
      );
      setBedrooms(
        typeof property.characteristics.bedrooms === "number"
          ? String(property.characteristics.bedrooms)
          : ""
      );
      setBathrooms(
        typeof property.characteristics.bathrooms === "number"
          ? String(property.characteristics.bathrooms)
          : ""
      );
      setRooms(
        typeof property.characteristics.rooms === "number"
          ? String(property.characteristics.rooms)
          : ""
      );
      setElevator(property.characteristics.elevator);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
          return;
        }
        if (error.status === 403) {
          navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
          return;
        }
      }
      const message = error instanceof Error ? error.message : "Unable to load property form.";
      setFormError(message);
    } finally {
      setLoadingInitial(false);
    }
  }, [isEditMode, navigation, propertyId]);

  useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  const validateForm = useCallback((): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (title.trim().length === 0) {
      nextErrors.title = "Title is required.";
    }
    if (description.trim().length === 0) {
      nextErrors.description = "Description is required.";
    }
    if (address.trim().length === 0) {
      nextErrors.address = "Address is required.";
    }
    if (city.trim().length === 0) {
      nextErrors.city = "City is required.";
    }
    if (postalCode.trim().length === 0) {
      nextErrors.postalCode = "Postal code is required.";
    }
    if (propertyType.trim().length === 0) {
      nextErrors.propertyType = "Property type is required.";
    }
    if (operationMode.length === 0) {
      nextErrors.operationMode = "Operation mode is required.";
    }

    const normalizedSalePrice = salePrice.trim();
    const normalizedRentalPrice = rentalPrice.trim();
    const normalizedGaragePrice = garagePrice.trim();
    const normalizedBedrooms = bedrooms.trim();
    const normalizedBathrooms = bathrooms.trim();
    const normalizedRooms = rooms.trim();

    if ((operationMode === "sale" || operationMode === "both") && normalizedSalePrice.length === 0) {
      nextErrors.salePrice = "Sale price is required for the selected operation mode.";
    }
    if ((operationMode === "rent" || operationMode === "both") && normalizedRentalPrice.length === 0) {
      nextErrors.rentalPrice = "Rental price is required for the selected operation mode.";
    }
    if (garagePriceCategoryId !== null && normalizedGaragePrice.length === 0) {
      nextErrors.garagePrice = "Garage price is required when a garage category is selected.";
    }
    if (isResidential && normalizedBedrooms.length === 0) {
      nextErrors.bedrooms = "Bedrooms are required for residential property types.";
    }
    if (isResidential && normalizedBathrooms.length === 0) {
      nextErrors.bathrooms = "Bathrooms are required for residential property types.";
    }

    if (normalizedSalePrice.length > 0) {
      const parsed = Number(normalizedSalePrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors.salePrice = "Sale price must be a non-negative number.";
      }
    }
    if (normalizedRentalPrice.length > 0) {
      const parsed = Number(normalizedRentalPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors.rentalPrice = "Rental price must be a non-negative number.";
      }
    }
    if (normalizedGaragePrice.length > 0) {
      const parsed = Number(normalizedGaragePrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors.garagePrice = "Garage price must be a non-negative number.";
      }
    }

    if (normalizedBedrooms.length > 0) {
      if (!isIntegerString(normalizedBedrooms) || Number.parseInt(normalizedBedrooms, 10) < 0) {
        nextErrors.bedrooms = "Bedrooms must be a non-negative integer.";
      }
    }
    if (normalizedBathrooms.length > 0) {
      if (!isIntegerString(normalizedBathrooms) || Number.parseInt(normalizedBathrooms, 10) < 0) {
        nextErrors.bathrooms = "Bathrooms must be a non-negative integer.";
      }
    }
    if (normalizedRooms.length > 0) {
      if (!isIntegerString(normalizedRooms) || Number.parseInt(normalizedRooms, 10) < 0) {
        nextErrors.rooms = "Rooms must be a non-negative integer.";
      }
    }

    return nextErrors;
  }, [
    address,
    bathrooms,
    bedrooms,
    city,
    description,
    garagePrice,
    garagePriceCategoryId,
    isResidential,
    operationMode,
    postalCode,
    propertyType,
    rentalPrice,
    rooms,
    salePrice,
    title,
  ]);

  const onSubmit = useCallback(async () => {
    setSubmitting(true);
    clearAllErrors();

    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitting(false);
      return;
    }

    const parsedSalePrice = parseOptionalNumber(salePrice);
    const parsedRentalPrice = parseOptionalNumber(rentalPrice);
    const parsedGaragePrice = parseOptionalNumber(garagePrice);
    const parsedBedrooms = parseOptionalInteger(bedrooms);
    const parsedBathrooms = parseOptionalInteger(bathrooms);
    const parsedRooms = parseOptionalInteger(rooms);
    const derivedPrice = deriveCanonicalPrice(
      operationMode,
      parsedSalePrice,
      parsedRentalPrice,
      parsedGaragePrice
    );

    const payload: PropertyFormInput = {
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      status,
      propertyType: propertyType.trim(),
      operationMode: operationMode as PropertyOperationMode,
      price: derivedPrice,
      salePrice: parsedSalePrice,
      rentalPrice: parsedRentalPrice,
      garagePriceCategoryId:
        garagePriceCategoryId !== null ? Number.parseInt(garagePriceCategoryId, 10) : null,
      garagePrice: parsedGaragePrice,
      bedrooms: parsedBedrooms,
      bathrooms: parsedBathrooms,
      rooms: parsedRooms,
      elevator,
    };

    try {
      const updated =
        isEditMode && propertyId
          ? await updatePropertyForm(propertyId, payload)
          : await createProperty(payload);

      navigation.replace("PropertyDetail", {
        propertyId: updated.id,
        propertyTitle: updated.title,
      });
    } catch (error) {
      if (error instanceof PropertyFormError) {
        setFormError(error.message);
        setFieldErrors({
          title: firstError(error.fields, "title"),
          description: firstError(error.fields, "description"),
          address: firstError(error.fields, "address"),
          city: firstError(error.fields, "city"),
          postalCode: firstError(error.fields, "postal_code"),
          status: firstError(error.fields, "status"),
          propertyType: firstError(error.fields, "property_type"),
          operationMode: firstError(error.fields, "operation_mode"),
          salePrice: firstError(error.fields, "sale_price"),
          rentalPrice: firstError(error.fields, "rental_price"),
          garagePriceCategoryId: firstError(error.fields, "garage_price_category_id"),
          garagePrice: firstError(error.fields, "garage_price"),
          bedrooms: firstError(error.fields, "bedrooms"),
          bathrooms: firstError(error.fields, "bathrooms"),
          rooms: firstError(error.fields, "rooms"),
          elevator: firstError(error.fields, "elevator"),
        });
        return;
      }

      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
          return;
        }
        if (error.status === 403) {
          navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
          return;
        }
      }

      const message = error instanceof Error ? error.message : "Unable to save property.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    address,
    bathrooms,
    bedrooms,
    city,
    clearAllErrors,
    description,
    elevator,
    garagePrice,
    garagePriceCategoryId,
    isEditMode,
    navigation,
    operationMode,
    postalCode,
    propertyId,
    propertyType,
    rentalPrice,
    rooms,
    salePrice,
    status,
    title,
    validateForm,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.subtitle}>
          {isEditMode
            ? "Update the full manager property form without breaking parity with the backend contract."
            : "Create a property using the enriched Wave 27 manager contract."}
        </Text>

        {loadingInitial ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading property data...</Text>
          </View>
        ) : (
          <>
            <SectionCard title="Identity">
              <FieldLabel label="Title" />
              <TextInput
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  clearFieldError("title");
                }}
                placeholder="Modern Loft Center"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldError error={fieldErrors.title} />

              <FieldLabel label="Description" />
              <TextInput
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  clearFieldError("description");
                }}
                multiline
                placeholder="Add operational notes and commercial summary."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textArea]}
              />
              <FieldError error={fieldErrors.description} />
            </SectionCard>

            <SectionCard title="Location">
              <FieldLabel label="Address" />
              <TextInput
                value={address}
                onChangeText={(value) => {
                  setAddress(value);
                  clearFieldError("address");
                }}
                placeholder="Calle Gran Via 45"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldError error={fieldErrors.address} />

              <FieldLabel label="City" />
              <TextInput
                value={city}
                onChangeText={(value) => {
                  setCity(value);
                  clearFieldError("city");
                }}
                placeholder="Madrid"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldError error={fieldErrors.city} />

              <FieldLabel label="Postal code" />
              <TextInput
                value={postalCode}
                onChangeText={(value) => {
                  setPostalCode(value);
                  clearFieldError("postalCode");
                }}
                placeholder="28013"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldError error={fieldErrors.postalCode} />
            </SectionCard>

            <SectionCard title="Commercial">
              <FieldLabel label="Status" />
              <OptionRow>
                {statusOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={option === status}
                    onPress={() => {
                      setStatus(option);
                      clearFieldError("status");
                    }}
                  />
                ))}
              </OptionRow>
              <FieldError error={fieldErrors.status} />

              <FieldLabel label="Property type" />
              <OptionRow>
                {propertyTypeOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={option === propertyType}
                    onPress={() => {
                      setPropertyType(option);
                      clearFieldError("propertyType");
                    }}
                  />
                ))}
              </OptionRow>
              <FieldError error={fieldErrors.propertyType} />

              <FieldLabel label="Operation mode" />
              <OptionRow>
                {operationModeOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={option === operationMode}
                    onPress={() => {
                      setOperationMode(option);
                      clearFieldError("operationMode");
                    }}
                  />
                ))}
              </OptionRow>
              <FieldError error={fieldErrors.operationMode} />
            </SectionCard>

            <SectionCard title="Pricing">
              <FieldLabel label="Sale price (EUR)" />
              <TextInput
                value={salePrice}
                onChangeText={(value) => {
                  setSalePrice(value);
                  clearFieldError("salePrice");
                }}
                keyboardType="numeric"
                placeholder="235000"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldHelper text="Required when operation mode includes sale." />
              <FieldError error={fieldErrors.salePrice} />

              <FieldLabel label="Rental price (EUR)" />
              <TextInput
                value={rentalPrice}
                onChangeText={(value) => {
                  setRentalPrice(value);
                  clearFieldError("rentalPrice");
                }}
                keyboardType="numeric"
                placeholder="1250"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldHelper text="Required when operation mode includes rent." />
              <FieldError error={fieldErrors.rentalPrice} />

              <FieldLabel label="Garage category" />
              <OptionRow>
                <OptionButton
                  label="None"
                  selected={garagePriceCategoryId === null}
                  onPress={() => {
                    setGaragePriceCategoryId(null);
                    clearFieldError("garagePriceCategoryId");
                    clearFieldError("garagePrice");
                  }}
                />
                {garageCategoryOptions.map((option) => (
                  <OptionButton
                    key={option.id}
                    label={option.label}
                    selected={garagePriceCategoryId === option.id}
                    onPress={() => {
                      setGaragePriceCategoryId(option.id);
                      clearFieldError("garagePriceCategoryId");
                    }}
                  />
                ))}
              </OptionRow>
              <FieldError error={fieldErrors.garagePriceCategoryId} />

              <FieldLabel label="Garage price (EUR)" />
              <TextInput
                value={garagePrice}
                onChangeText={(value) => {
                  setGaragePrice(value);
                  clearFieldError("garagePrice");
                }}
                keyboardType="numeric"
                placeholder="18000"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldHelper text="Required when a garage category is selected." />
              <FieldError error={fieldErrors.garagePrice} />
            </SectionCard>

            <SectionCard title="Characteristics">
              <FieldLabel label="Bedrooms" />
              <TextInput
                value={bedrooms}
                onChangeText={(value) => {
                  setBedrooms(value);
                  clearFieldError("bedrooms");
                }}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldHelper text="Required for residential property types." />
              <FieldError error={fieldErrors.bedrooms} />

              <FieldLabel label="Bathrooms" />
              <TextInput
                value={bathrooms}
                onChangeText={(value) => {
                  setBathrooms(value);
                  clearFieldError("bathrooms");
                }}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldHelper text="Required for residential property types." />
              <FieldError error={fieldErrors.bathrooms} />

              <FieldLabel label="Rooms" />
              <TextInput
                value={rooms}
                onChangeText={(value) => {
                  setRooms(value);
                  clearFieldError("rooms");
                }}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <FieldError error={fieldErrors.rooms} />

              <FieldLabel label="Elevator" />
              <OptionRow>
                <OptionButton
                  label="Unknown"
                  selected={elevator === null}
                  onPress={() => {
                    setElevator(null);
                    clearFieldError("elevator");
                  }}
                />
                <OptionButton
                  label="Yes"
                  selected={elevator === true}
                  onPress={() => {
                    setElevator(true);
                    clearFieldError("elevator");
                  }}
                />
                <OptionButton
                  label="No"
                  selected={elevator === false}
                  onPress={() => {
                    setElevator(false);
                    clearFieldError("elevator");
                  }}
                />
              </OptionRow>
              <FieldError error={fieldErrors.elevator} />
            </SectionCard>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? "Saving..." : "Save Property"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

type SectionCardProps = {
  title: string;
  children: React.ReactNode;
};

const SectionCard: React.FC<SectionCardProps> = ({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

type OptionButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const OptionButton: React.FC<OptionButtonProps> = ({ label, selected, onPress }) => (
  <Pressable style={[styles.optionButton, selected && styles.optionButtonSelected]} onPress={onPress}>
    <Text style={[styles.optionButtonText, selected && styles.optionButtonTextSelected]}>{label}</Text>
  </Pressable>
);

const OptionRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.optionRow}>{children}</View>
);

const FieldLabel: React.FC<{ label: string }> = ({ label }) => <Text style={styles.label}>{label}</Text>;

const FieldHelper: React.FC<{ text: string }> = ({ text }) => (
  <Text style={styles.fieldHelper}>{text}</Text>
);

const FieldError: React.FC<{ error?: string }> = ({ error }) =>
  error ? <Text style={styles.fieldError}>{error}</Text> : null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  loadingWrap: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionButton: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionButtonSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  optionButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  optionButtonTextSelected: {
    color: colors.surface,
  },
  fieldHelper: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  fieldError: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  formError: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    marginTop: spacing.lg,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
});

export default PropertyEditorScreen;
