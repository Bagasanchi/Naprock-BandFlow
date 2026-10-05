import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type SkillTagsEditorProps = {
  skills: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
  colors: { border: string; title: string; body: string; accent: string; accentSoft: string; inputBg: string; placeholder: string; danger: string };
};

// Same limits the server enforces (server/recommend.mjs).
const maxSkills = 12;
const maxSkillLength = 24;

// Skill tags as removable chips plus a field to add more. Several can be typed at once, separated by commas.
export default function SkillTagsEditor({ skills, onChange, disabled, colors }: SkillTagsEditorProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const next = [...skills];
    for (const part of draft.split(/[,;\n]/)) {
      const tag = part.replace(/\s+/g, ' ').trim();
      if (!tag || next.some((skill) => skill.toLowerCase() === tag.toLowerCase())) continue;
      if (tag.length > maxSkillLength) return setError(`A skill can be at most ${maxSkillLength} characters.`);
      next.push(tag);
    }
    if (next.length > maxSkills) return setError(`At most ${maxSkills} skills.`);
    setError('');
    setDraft('');
    if (next.length !== skills.length) onChange(next);
  };

  return (
    <View>
      {skills.length > 0 ? (
        <View style={styles.chips}>
          {skills.map((skill) => (
            <View key={skill} style={[styles.chip, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.chipText, { color: colors.title }]}>{skill}</Text>
              <Pressable accessibilityLabel={`Remove ${skill}`} disabled={disabled} hitSlop={8} onPress={() => onChange(skills.filter((item) => item !== skill))}>
                <Text style={[styles.chipRemove, { color: colors.body }]}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.body }]}>No skills yet. Without them, every work looks like a skill mismatch.</Text>
      )}
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={(value) => { setDraft(value); setError(''); }}
          onSubmitEditing={add}
          editable={!disabled}
          placeholder="e.g. Design, Welding"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.title }]}
        />
        <Pressable disabled={disabled || !draft.trim()} onPress={add} style={[styles.addButton, { backgroundColor: colors.accentSoft, opacity: disabled || !draft.trim() ? 0.5 : 1 }]}>
          <Text style={[styles.addText, { color: colors.accent }]}>Add</Text>
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 8, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipRemove: { fontSize: 16, lineHeight: 17, fontWeight: '700' },
  empty: { fontSize: 12, lineHeight: 17 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  addButton: { minWidth: 64, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  addText: { fontSize: 13, fontWeight: '900' },
  error: { fontSize: 12, fontWeight: '600', marginTop: 6 },
});
