import React from 'react';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { InlineToken, parseSafeMarkdown } from './safeMarkdownParser';

export interface SafeMarkdownStyles {
  body?: StyleProp<TextStyle>;
  heading1?: StyleProp<TextStyle>;
  heading2?: StyleProp<TextStyle>;
  heading3?: StyleProp<TextStyle>;
  strong?: StyleProp<TextStyle>;
  em?: StyleProp<TextStyle>;
  paragraph?: StyleProp<TextStyle>;
  bullet_list?: StyleProp<ViewStyle>;
  bullet_list_icon?: StyleProp<TextStyle>;
  list_item?: StyleProp<ViewStyle>;
  code_inline?: StyleProp<TextStyle>;
  fence?: StyleProp<TextStyle>;
  table?: StyleProp<ViewStyle>;
  thead?: StyleProp<ViewStyle>;
  th?: StyleProp<TextStyle>;
  td?: StyleProp<TextStyle>;
  blockquote?: StyleProp<ViewStyle>;
  link?: StyleProp<TextStyle>;
}

interface SafeMarkdownProps {
  source: string;
  style: SafeMarkdownStyles;
}

function renderInline(tokens: InlineToken[], style: SafeMarkdownStyles): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    switch (token.type) {
      case 'strong':
        return <Text key={key} style={style.strong}>{token.text}</Text>;
      case 'emphasis':
        return <Text key={key} style={style.em}>{token.text}</Text>;
      case 'code':
        return <Text key={key} style={style.code_inline}>{token.text}</Text>;
      case 'link':
        return (
          <Text
            key={key}
            accessibilityRole="link"
            style={style.link}
            onPress={() => { void Linking.openURL(token.url).catch(() => undefined); }}
          >
            {token.text}
          </Text>
        );
      default:
        return token.text;
    }
  });
}

export default function SafeMarkdown({ source, style }: SafeMarkdownProps): React.ReactElement {
  const blocks = parseSafeMarkdown(source);

  return (
    <View>
      {blocks.map((block, blockIndex) => {
        const key = `${block.type}-${blockIndex}`;
        switch (block.type) {
          case 'heading': {
            const headingStyle = block.level === 1
              ? style.heading1
              : block.level === 2
                ? style.heading2
                : style.heading3;
            return <Text key={key} style={[style.body, headingStyle]}>{renderInline(block.content, style)}</Text>;
          }
          case 'list':
            return (
              <View key={key} style={style.bullet_list}>
                {block.items.map((item, itemIndex) => (
                  <View key={`${key}-${itemIndex}`} style={[rendererStyles.listItem, style.list_item]}>
                    <Text style={[rendererStyles.listMarker, style.bullet_list_icon]}>
                      {block.ordered ? `${itemIndex + 1}.` : '•'}
                    </Text>
                    <Text style={[rendererStyles.listText, style.body]}>{renderInline(item, style)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'code':
            return <Text key={key} selectable style={[style.body, style.fence]}>{block.content}</Text>;
          case 'quote':
            return (
              <View key={key} style={style.blockquote}>
                <Text style={style.body}>{renderInline(block.content, style)}</Text>
              </View>
            );
          case 'table':
            return (
              <View key={key} style={style.table}>
                <View style={[rendererStyles.tableRow, style.thead]}>
                  {block.headers.map((header, cellIndex) => (
                    <Text key={`${key}-header-${cellIndex}`} style={[rendererStyles.tableCell, style.body, style.th]}>
                      {renderInline(header, style)}
                    </Text>
                  ))}
                </View>
                {block.rows.map((row, rowIndex) => (
                  <View key={`${key}-row-${rowIndex}`} style={rendererStyles.tableRow}>
                    {row.map((cell, cellIndex) => (
                      <Text key={`${key}-cell-${rowIndex}-${cellIndex}`} style={[rendererStyles.tableCell, style.body, style.td]}>
                        {renderInline(cell, style)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          default:
            return <Text key={key} style={[style.body, style.paragraph]}>{renderInline(block.content, style)}</Text>;
        }
      })}
    </View>
  );
}

const rendererStyles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listMarker: {
    minWidth: 18,
  },
  listText: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    flex: 1,
  },
});
