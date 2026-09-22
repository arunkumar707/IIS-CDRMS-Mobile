import { Search, XCircle } from 'lucide-react-native';
import { useCallback, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Box } from '@/components/ui/box';
import { cardSurfaceStyle } from '@/src/cdrms/lib/cardSurface';
import { COLORS, FONTS } from '@/src/cdrms/theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Extra control on the right (e.g. refresh). Shown after the clear button. */
  endAdornment?: ReactNode;
  nested?: boolean;
  height?: number;
  iconColor?: string;
  placeholderTextColor?: string;
  className?: string;
  style?: ViewStyle;
  inputStyle?: TextInputProps['style'];
};

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search…',
  endAdornment,
  nested = true,
  height = 44,
  iconColor = COLORS.slate,
  placeholderTextColor = COLORS.slate,
  className,
  style,
  inputStyle,
}: SearchFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const hasValue = value.length > 0;

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, [onChangeText]);

  return (
    <Box
      className={`flex-row items-center ${className ?? ''}`}
      style={[
        nested ? cardSurfaceStyle({ nested: true }) : null,
        { paddingHorizontal: 12, height, overflow: 'hidden' },
        style,
      ]}
    >
      <Search size={15} color={iconColor} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        returnKeyType="search"
        numberOfLines={1}
        style={[
          {
            flex: 1,
            marginLeft: 8,
            fontSize: 15,
            lineHeight: 20,
            fontFamily: FONTS.medium,
            color: COLORS.ink,
            paddingVertical: 0,
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
          },
          inputStyle,
        ]}
      />
      {hasValue ? (
        <TouchableOpacity
          onPress={Platform.OS === 'web' ? undefined : handleClear}
          {...(Platform.OS === 'web'
            ? {
                onMouseDown: (event) => {
                  event.preventDefault();
                  handleClear();
                },
              }
            : null)}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.65}
          style={{ marginLeft: 4, padding: 4, zIndex: 2 }}
        >
          <XCircle size={18} color={COLORS.slate} />
        </TouchableOpacity>
      ) : null}
      {endAdornment ? (
        <Box style={{ marginLeft: hasValue ? 6 : 4 }}>{endAdornment}</Box>
      ) : null}
    </Box>
  );
}
