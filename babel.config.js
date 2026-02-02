module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ['module-resolver', {
        alias: {
          '@': './src',
        },
      }],
      ...(process.env.NODE_ENV === 'production'
        ? ['transform-remove-console']
        : []),
    ],
  };
};
