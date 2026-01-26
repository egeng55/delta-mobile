import type { Model3DViewerProps } from './DeltaBodyScanner.types';
export interface Model3DViewerRef {
    resetCamera: () => void;
    snapshot: () => Promise<string | null>;
}
export declare const Model3DViewer: import("react").ForwardRefExoticComponent<Model3DViewerProps & import("react").RefAttributes<Model3DViewerRef>>;
