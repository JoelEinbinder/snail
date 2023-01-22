type SourceMapv3 = {
  mappings: string,
  names: string[],
  sources: string[],
  sourcesContent: string[],
  version: 3,
};
export async function* parseSourceMap(url: string, sourceMapURL: string) {
  const response = await fetch(new URL(sourceMapURL, url).href);
  const sourceMap = await response.json() as SourceMapv3;
  for (let i = 0; i < sourceMap.sources.length; i++) {
    const source = sourceMap.sources[i];
    const sourceContent = sourceMap.sourcesContent[i];
    const sourceURL = new URL(source, url).href;
    yield {url: sourceURL, content: sourceContent};
  }
}