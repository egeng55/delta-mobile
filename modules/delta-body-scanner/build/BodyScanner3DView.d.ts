import type { BodyScanner3DViewProps } from './DeltaBodyScanner.types';
export interface BodyScanner3DViewRef {
    startScan: () => void;
    stopScan: () => void;
    capturePhoto: () => void;
}
export declare const BodyScanner3DView: import("react").ForwardRefExoticComponent<BodyScanner3DViewProps & import("react").RefAttributes<BodyScanner3DViewRef>>;
