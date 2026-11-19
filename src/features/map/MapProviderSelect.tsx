import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/ui/theme';
import { MAP_PROVIDERS, useMapProvider } from './mapProvider';

interface Props {
  style?: StyleProp<ViewStyle>;
}

/** 지도 위에 띄우는 지도 제공자 선택 박스. 누르면 목록이 열린다. */
export function MapProviderSelect({ style }: Props) {
  const provider = useMapProvider((s) => s.provider);
  const setProvider = useMapProvider((s) => s.setProvider);
  const [open, setOpen] = useState(false);
  const currentIndex = MAP_PROVIDERS.findIndex((p) => p.id === provider);
  const current = MAP_PROVIDERS[currentIndex];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`지도 선택, 현재 ${current?.label}`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed, style]}
      >
        <Text style={styles.triggerText}>
          {currentIndex + 1}. {current?.label}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="닫기">
          {/* 시트 안을 눌렀을 때 닫히지 않도록 이벤트를 막는다 */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>지도 선택</Text>
            {MAP_PROVIDERS.map((option, i) => {
              const selected = option.id === provider;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setProvider(option.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>
                      {i + 1}. {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  triggerText: { fontSize: 12, fontWeight: '600', color: colors.text },
  caret: { fontSize: 12, color: colors.textMuted, marginLeft: spacing.xs },
  pressed: { opacity: 0.7 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionBody: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
