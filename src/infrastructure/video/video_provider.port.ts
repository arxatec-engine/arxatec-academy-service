export interface VideoProbe {
  duration_seconds: number | null;
  title: string;
  thumbnail_url: string | null;
}

export interface VideoProviderPort {
  probe(external_id: string): Promise<VideoProbe>;
}
