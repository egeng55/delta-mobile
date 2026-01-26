# Delta Body Scanner

Native Expo module for real 3D body scanning using iPhone LiDAR sensor (primary) with photogrammetry fallback for non-LiDAR devices.

## Device Support

| Device | iOS Version | Capability | Experience |
|--------|-------------|------------|------------|
| iPhone 12 Pro+ / iPad Pro | 14+ | LiDAR | Real-time 3D mesh capture |
| iPhone 12+ (non-Pro) | 17+ | Photogrammetry | Guided photo capture → 3D model |
| Older devices | Any | None | Template-only fallback |

## Installation

The module is included as a local package. Run:

```bash
npm install
cd ios && pod install
```

## Usage

### Check Device Capabilities

```typescript
import { hasLiDAR, supportsPhotogrammetry, getCapabilities } from 'delta-body-scanner';

// Synchronous checks
console.log('LiDAR:', hasLiDAR);
console.log('Photogrammetry:', supportsPhotogrammetry);

// Detailed capabilities
const caps = await getCapabilities();
console.log(caps);
// { hasLiDAR: true, supportsPhotogrammetry: true, supportedMethods: ['lidar', 'photogrammetry', 'template'], ... }
```

### Using the Scanner Hook

```typescript
import { useBodyScanner } from 'delta-body-scanner';

function ScanScreen() {
  const {
    capabilities,
    scanProgress,
    isScanning,
    scanResult,
    error,
    startScan,
    stopScan,
    getBestScanMethod,
    scannerRef,
  } = useBodyScanner();

  const bestMethod = getBestScanMethod(); // 'lidar' | 'photogrammetry' | 'template'

  return (
    <BodyScanner3DView
      ref={scannerRef}
      scanMethod={bestMethod}
      autoStart={false}
      onScanProgress={(e) => console.log(e.nativeEvent.progress)}
      onScanComplete={(e) => console.log(e.nativeEvent.result)}
    />
  );
}
```

### Displaying 3D Models

```typescript
import { Model3DViewer } from 'delta-body-scanner';

function AvatarDisplay({ meshUri }) {
  return (
    <Model3DViewer
      modelUri={meshUri}
      autoRotate={true}
      allowUserInteraction={true}
      backgroundColor="#000000"
      lightingIntensity={1.2}
      style={{ width: 280, height: 280 }}
    />
  );
}
```

## Components

### BodyScanner3DView

Native AR view for capturing 3D body scans.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| scanMethod | 'lidar' \| 'photogrammetry' | 'lidar' | Scanning method to use |
| autoStart | boolean | false | Start scanning automatically |
| showGuides | boolean | true | Show pose guides overlay |
| showMeshPreview | boolean | true | Show real-time mesh preview |
| onScanProgress | function | - | Progress callback |
| onScanComplete | function | - | Completion callback |
| onScanError | function | - | Error callback |

### Model3DViewer

SceneKit-based 3D model viewer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| modelUri | string | required | URI to USDZ/GLB file |
| autoRotate | boolean | true | Auto-rotate the model |
| allowUserInteraction | boolean | true | Allow pinch/rotate gestures |
| backgroundColor | string | '#000000' | View background color |
| lightingIntensity | number | 1.0 | Light intensity multiplier |

## Events

### ScanProgress

```typescript
interface ScanProgress {
  state: 'idle' | 'initializing' | 'scanning' | 'processing' | 'complete' | 'error';
  coverage: number; // 0-100
  guidanceMessage: string;
  meshVertexCount?: number;
}
```

### ScanResult

```typescript
interface ScanResult {
  success: boolean;
  meshFileUri?: string;
  meshFormat?: 'usdz' | 'glb';
  thumbnailUri?: string;
  scanMethod: 'lidar' | 'photogrammetry';
  scanDate: string;
  scanDuration: number;
  meshVertexCount?: number;
  error?: string;
}
```

## Storage

Mesh files are stored locally at:
```
Documents/delta-scans/{userId}/
├── body_scan_2024-01-26.usdz
├── body_scan_thumb.png
└── metadata.json
```

## Privacy

- All processing happens on-device
- No images are uploaded to servers
- Only mesh files and metadata are stored locally
- Users can delete their scans at any time

## Building

```bash
# Development build
npx expo run:ios

# Test on device (required for LiDAR)
npx expo run:ios --device
```

Note: LiDAR scanning requires a physical device with LiDAR sensor (iPhone 12 Pro or later).
