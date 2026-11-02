export type ArtifactKind = 'image' | 'pdf' | 'audio' | 'file';

export interface ArtifactRef {
  id: string;
  name: string;
  mime: string;
  kind: ArtifactKind;
  size: number;
  width?: number;
  height?: number;
  pages?: number;
  duration?: number;
}
