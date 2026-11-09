export declare const ROOT: string;
export declare const WIDGETS_DIR: string;
export declare function listWidgets(): string[];
export declare function bundleWidget(
  name: string,
  opts?: { write?: boolean; minify?: boolean; outDir?: string },
): Promise<string>;
