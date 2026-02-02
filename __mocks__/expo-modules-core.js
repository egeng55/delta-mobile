module.exports = {
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => null,
  NativeModulesProxy: {},
  EventEmitter: class EventEmitter {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    emit() {}
  },
  requireNativeViewManager: () => 'View',
};
