import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type * as ImagePickerModule from 'expo-image-picker';
import Avatar from './Avatar';
import { getProfile, updateProfile, type ApiProfile } from '../lib/api';
import { getRoleTheme, type Role } from '../lib/roleTheme';

type ProfileProps = {
  isDarkTheme: boolean;
  role: Role;
  onBack: () => void;
  onProfileChanged: (profile: ApiProfile) => void;
};

type Draft = { fullName: string; email: string; phone: string; jobTitle: string; avatar: string | null };

const maxAvatarLength = 2_000_000;

// Loaded on demand: expo-image-picker throws on import when the installed development
// build predates it, and that would otherwise crash the whole app instead of this button.
function loadImagePicker(): typeof ImagePickerModule | null {
  try {
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

function describeError(error: unknown, fallback: string) {
  if ((error as { status?: number })?.status === 404) return 'The BandFlow server is running an older version. Restart it with "npm run server" and try again.';
  return error instanceof Error ? error.message : fallback;
}
const toDraft = (profile: ApiProfile): Draft => ({ fullName: profile.fullName, email: profile.email, phone: profile.phone, jobTitle: profile.jobTitle, avatar: profile.avatar });

export default function Profile({ isDarkTheme, role, onBack, onProfileChanged }: ProfileProps) {
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const theme = getRoleTheme(role, isDarkTheme);

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((result) => {
        if (!isMounted) return;
        setProfile(result);
        setDraft(toDraft(result));
      })
      .catch((error) => isMounted && setErrorMessage(describeError(error, 'Unable to load your profile.')))
      .finally(() => isMounted && setIsLoading(false));
    return () => {
      isMounted = false;
    };
  }, []);

  const isDirty = Boolean(profile && draft && JSON.stringify(toDraft(profile)) !== JSON.stringify(draft));

  const edit = (field: keyof Draft, value: string | null) => {
    setSuccessMessage('');
    setDraft((current) => current && { ...current, [field]: value });
  };

  const pickPhoto = async (source: 'library' | 'camera') => {
    setShowPhotoOptions(false);
    setErrorMessage('');
    const ImagePicker = loadImagePicker();
    if (!ImagePicker) {
      setErrorMessage('Photo picking is not available in this version of the app. Rebuild the development build (eas build --profile development) or open BandFlow in Expo Go.');
      return;
    }
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Camera access is needed to take a profile picture. You can allow it in your phone settings.');
        return;
      }
    }
    const options: ImagePickerModule.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setErrorMessage('That photo could not be read. Please try another one.');
      return;
    }
    const dataUri = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
    if (dataUri.length > maxAvatarLength) {
      setErrorMessage('That photo is too large. Try cropping it closer or choosing a smaller one.');
      return;
    }
    edit('avatar', dataUri);
  };

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const saved = await updateProfile(draft);
      setProfile(saved);
      setDraft(toDraft(saved));
      onProfileChanged(saved);
      setSuccessMessage('Profile saved.');
    } catch (error) {
      setErrorMessage(describeError(error, 'Unable to save your profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.title }];
  const fields: Array<{ key: 'fullName' | 'email' | 'phone' | 'jobTitle'; label: string; placeholder: string; keyboardType?: 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'words' }> = [
    { key: 'fullName', label: 'Full name', placeholder: 'Your name', autoCapitalize: 'words' },
    { key: 'email', label: 'Email', placeholder: 'name@example.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'phone', label: 'Phone number', placeholder: '+976 9911 2233', keyboardType: 'phone-pad' },
    { key: 'jobTitle', label: 'Job title', placeholder: role === 'boss' ? 'e.g. Site manager' : 'e.g. Electrician', autoCapitalize: 'words' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.border }]}><Text style={[styles.backText, { color: theme.accent }]}>Back</Text></Pressable>
            <View style={styles.headingCopy}>
              <Text style={[styles.title, { color: theme.title }]}>Profile</Text>
              <Text style={[styles.subtitle, { color: theme.body }]}>Your photo and contact details</Text>
            </View>
          </View>

          {isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}

          {draft && profile ? (
            <>
              <View style={[styles.card, styles.photoCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                <Pressable accessibilityLabel="Change profile picture" onPress={() => setShowPhotoOptions((current) => !current)}>
                  <Avatar name={draft.fullName || profile.fullName} uri={draft.avatar} size={104} backgroundColor={theme.accent} />
                  <View style={[styles.editBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}><Text style={styles.editBadgeIcon}>📷</Text></View>
                </Pressable>
                <Text style={[styles.photoName, { color: theme.title }]}>{draft.fullName || 'Your name'}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.roleChip, { backgroundColor: theme.accent }]}><Text style={[styles.roleChipText, { color: theme.accentText }]}>{profile.role === 'boss' ? 'Boss' : 'Worker'}</Text></View>
                  <Text style={[styles.memberSince, { color: theme.body }]}>Member since {profile.createdAt.slice(0, 10)}</Text>
                </View>
                {showPhotoOptions ? (
                  <View style={styles.photoOptions}>
                    <Pressable onPress={() => void pickPhoto('library')} style={[styles.photoOption, { borderColor: theme.accent, backgroundColor: theme.surface }]}><Text style={[styles.photoOptionText, { color: theme.accent }]}>Choose photo</Text></Pressable>
                    <Pressable onPress={() => void pickPhoto('camera')} style={[styles.photoOption, { borderColor: theme.accent, backgroundColor: theme.surface }]}><Text style={[styles.photoOptionText, { color: theme.accent }]}>Take photo</Text></Pressable>
                    {draft.avatar ? (
                      <Pressable onPress={() => { setShowPhotoOptions(false); edit('avatar', null); }} style={[styles.photoOption, { borderColor: theme.danger, backgroundColor: theme.surface }]}><Text style={[styles.photoOptionText, { color: theme.danger }]}>Remove</Text></Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.photoHint, { color: theme.body }]}>Tap the photo to change it</Text>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.title }]}>Personal information</Text>
                {fields.map((field) => (
                  <View key={field.key}>
                    <Text style={[styles.label, { color: theme.body }]}>{field.label}</Text>
                    <TextInput
                      value={draft[field.key]}
                      onChangeText={(value) => edit(field.key, value)}
                      placeholder={field.placeholder}
                      placeholderTextColor={isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : '#9AA8BC'}
                      keyboardType={field.keyboardType}
                      autoCapitalize={field.autoCapitalize}
                      autoCorrect={false}
                      style={inputStyle}
                    />
                  </View>
                ))}
              </View>

              {errorMessage ? <Text style={[styles.message, { color: theme.danger }]}>{errorMessage}</Text> : null}
              {successMessage ? <Text style={[styles.message, { color: theme.success }]}>{successMessage}</Text> : null}

              <Pressable
                disabled={!isDirty || isSaving}
                onPress={() => void save()}
                style={[styles.saveButton, { backgroundColor: theme.accent, opacity: !isDirty || isSaving ? 0.5 : 1 }]}
              >
                {isSaving ? <ActivityIndicator color={theme.accentText} /> : <Text style={[styles.saveText, { color: theme.accentText }]}>Save changes</Text>}
              </Pressable>
              {isDirty && !isSaving ? (
                <Pressable onPress={() => { setDraft(toDraft(profile)); setErrorMessage(''); }} hitSlop={8} style={styles.discard}>
                  <Text style={[styles.discardText, { color: theme.body }]}>Discard changes</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {!isLoading && !draft && errorMessage ? <Text style={[styles.message, { color: theme.danger }]}>{errorMessage}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 20, paddingTop: 86, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  backButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '800' },
  headingCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 4 },
  loader: { marginTop: 32 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  photoCard: { alignItems: 'center', paddingVertical: 22 },
  editBadge: { position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  editBadgeIcon: { fontSize: 14 },
  photoName: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  roleChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  roleChipText: { fontSize: 10, fontWeight: '900' },
  memberSince: { fontSize: 12, fontWeight: '600' },
  photoHint: { fontSize: 12, marginTop: 12 },
  photoOptions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  photoOption: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  photoOptionText: { fontSize: 12, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 15 },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  saveButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '900' },
  discard: { alignSelf: 'center', paddingVertical: 4 },
  discardText: { fontSize: 13, fontWeight: '700' },
});
