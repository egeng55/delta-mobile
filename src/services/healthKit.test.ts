jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, NativeModules: { HealthKitModule: {
  requestAuthorization: jest.fn(), isAuthorizationRequestComplete: jest.fn(),
} } }));
import { NativeModules } from 'react-native';
import healthKit from './healthKit';
test('completed permission request is usable without claiming a read grant', async () => {
  NativeModules.HealthKitModule.requestAuthorization.mockResolvedValue({ requestCompleted: true });
  expect(await healthKit.requestAuthorization()).toBe(true);
});
test('relaunch uses request status, not sharing authorization', async () => {
  NativeModules.HealthKitModule.isAuthorizationRequestComplete.mockResolvedValue({ requestCompleted: true });
  expect(await healthKit.isAuthorizationRequestComplete()).toBe(true);
});
test('old ambiguous authorized result and incomplete prompt do not imply completion', async () => {
  NativeModules.HealthKitModule.requestAuthorization.mockResolvedValue({ authorized: true });
  expect(await healthKit.requestAuthorization()).toBe(false);
  NativeModules.HealthKitModule.isAuthorizationRequestComplete.mockResolvedValue({ requestCompleted: false });
  expect(await healthKit.isAuthorizationRequestComplete()).toBe(false);
});
