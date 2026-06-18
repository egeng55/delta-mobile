const store = {};

module.exports = {
  getItemAsync: jest.fn((key) => Promise.resolve(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
  setItemAsync: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
  __clearStore: () => {
    Object.keys(store).forEach((key) => delete store[key]);
  },
  __getStore: () => ({ ...store }),
};
