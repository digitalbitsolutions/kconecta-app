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
  type PropertyStatus,
  updatePropertyForm,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyEditorRoute = RouteProp<ManagerStackParamList, "PropertyEditor">;
type PropertyEditorNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyEditor">;

type FormField = "title" | "city" | "status" | "price";
type FieldErrors = Partial<Record<FormField, string>>;

const statusOptions: PropertyStatus[] = ["available", "reserved", "maintenance"];

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

const PropertyEditorScreen = () => {
  const navigation = useNavigation<PropertyEditorNavigation>();
  const route = useRoute<PropertyEditorRoute>();
  const isEditMode = route.params.mode === "edit";
  const propertyId = route.params.mode === "edit" ? route.params.propertyId : null;

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<PropertyStatus>("available");
  const [price, setPrice] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const headerTitle = useMemo(
    () => (isEditMode ? "Edit Property" : "Create Property"),
    [isEditMode]
  );

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

  const loadProperty = useCallback(async () => {
    if (!isEditMode || !propertyId) {
      return;
    }

    setLoadingInitial(true);
    setFormError(null);
    try {
      const property = await fetchPropertyById(propertyId);
      setTitle(property.title);
      setCity(property.city);
      setStatus(property.status);
      const parsedPrice = Number(property.price.replace(/[^\d.-]/g, ""));
      setPrice(Number.isFinite(parsedPrice) ? String(parsedPrice) : "");
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

  const onSubmit = useCallback(async () => {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const trimmedTitle = title.trim();
    const trimmedCity = city.trim();
    const trimmedPrice = price.trim();

    const localErrors: FieldErrors = {};
    if (!trimmedTitle) {
      localErrors.title = "Title is required.";
    }
    if (!trimmedCity) {
      localErrors.city = "City is required.";
    }
    if (trimmedPrice.length > 0 && Number.isNaN(Number(trimmedPrice))) {
      localErrors.price = "Price must be numeric.";
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setSubmitting(false);
      return;
    }

    try {
      const updated = isEditMode && propertyId
        ? await updatePropertyForm(propertyId, {
            title: trimmedTitle,
            city: trimmedCity,
            status,
            price: trimmedPrice.length > 0 ? Number(trimmedPrice) : null,
          })
        : await createProperty({
            title: trimmedTitle,
            city: trimmedCity,
            status,
            price: trimmedPrice.length > 0 ? Number(trimmedPrice) : null,
          });

      navigation.replace("PropertyDetail", {
        propertyId: updated.id,
        propertyTitle: updated.title,
      });
    } catch (error) {
      if (error instanceof PropertyFormError) {
        setFormError(error.message);
        setFieldErrors({
          title: firstError(error.fields, "title"),
          city: firstError(error.fields, "city"),
          status: firstError(error.fields, "status"),
          price: firstError(error.fields, "price"),
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
  }, [city, isEditMode, navigation, price, propertyId, status, title]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.subtitle}>
          {isEditMode
            ? "Update property fields and keep manager portfolio in sync."
            : "Create a new property for manager operations."}
        </Text>

        {loadingInitial ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading property data...</Text>
          </View>
        ) : (
          <>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Title</Text>
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
              {fieldErrors.title ? <Text style={styles.fieldError}>{fieldErrors.title}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>City</Text>
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
              {fieldErrors.city ? <Text style={styles.fieldError}>{fieldErrors.city}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Price (EUR)</Text>
              <TextInput
                value={price}
                onChangeText={(value) => {
                  setPrice(value);
                  clearFieldError("price");
                }}
                keyboardType="numeric"
                placeholder="250000"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              {fieldErrors.price ? <Text style={styles.fieldError}>{fieldErrors.price}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusRow}>
                {statusOptions.map((option) => {
                  const selected = option === status;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.statusButton, selected && styles.statusButtonSelected]}
                      onPress={() => {
                        setStatus(option);
                        clearFieldError("status");
                      }}
                    >
                      <Text style={[styles.statusText, selected && styles.statusTextSelected]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {fieldErrors.status ? <Text style={styles.fieldError}>{fieldErrors.status}</Text> : null}
            </View>

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
  fieldWrap: {
    marginTop: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginBottom: spacing.xs,
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
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusButton: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusButtonSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  statusTextSelected: {
    color: colors.surface,
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
