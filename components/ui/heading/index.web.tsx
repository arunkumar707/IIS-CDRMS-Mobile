import React, { forwardRef, memo } from 'react';
import { Text as RNText } from 'react-native';
import { headingStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type IHeadingProps = VariantProps<typeof headingStyle> &
  React.ComponentPropsWithoutRef<typeof RNText> & {
    as?: React.ElementType;
  };

const Heading = memo(
  forwardRef<React.ComponentRef<typeof RNText>, IHeadingProps>(function Heading(
    { className, size = 'lg', as: AsComp, ...props },
    ref
  ) {
    const {
      isTruncated,
      bold,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
      ...rest
    } = props;

    const resolvedClassName = headingStyle({
      size,
      isTruncated: isTruncated as boolean,
      bold: bold as boolean,
      underline: underline as boolean,
      strikeThrough: strikeThrough as boolean,
      sub: sub as boolean,
      italic: italic as boolean,
      highlight: highlight as boolean,
      class: className,
    });

    if (AsComp) {
      return <AsComp className={resolvedClassName} {...rest} />;
    }

    return <RNText className={resolvedClassName} {...rest} ref={ref} />;
  })
);

Heading.displayName = 'Heading';

export { Heading };
