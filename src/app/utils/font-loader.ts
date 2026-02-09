export function loadFontDynamically(fontFamily: string, fontUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const w: any = window as any;

    if (!w || !w.FontFace || !document || !(document as any).fonts) {
      // FontFace not supported (older webOS)
      resolve(false);
      return;
    }

    try {
      const font = new w.FontFace(fontFamily, `url(${fontUrl})`);

      font.load()
        .then((loaded: any) => {
          (document as any).fonts.add(loaded);
          resolve(true);
        })
        .catch(() => resolve(false));

    } catch {
      resolve(false);
    }
  });
}
