const mockAuth = {
  getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  signUp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  signInWithPassword: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
};

const mockFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
}));

module.exports = {
  createClient: jest.fn(() => ({
    auth: mockAuth,
    from: mockFrom,
  })),
};
