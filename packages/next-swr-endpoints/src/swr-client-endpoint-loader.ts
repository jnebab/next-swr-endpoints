import type { LoaderDefinition } from "webpack";
import { parseEndpointFile } from "./parseEndpointFile";
import { ConcatSource, ReplaceSource, SourceMapSource } from "webpack-sources";
import path from "path";

const loader: LoaderDefinition<{
  projectDir: string;
  pageExtensionsRegex: RegExp;
  basePath: string;
}> = function (content, sourcemaps, additionalData) {
  const { projectDir, pageExtensionsRegex, basePath } = this.getOptions();
  const source = new ReplaceSource(
    new SourceMapSource(
      content,
      this.resourcePath,
      typeof sourcemaps === "string" ? JSON.parse(sourcemaps) : sourcemaps
    )
  );
  const parsed = parseEndpointFile(content);
  for (const [start, end] of parsed.regionsToRemove) {
    source.replace(start, end, "");
  }

  const resource = path
    .relative(projectDir, this.resourcePath)
    .replace(/^(src\/)?pages\//, "")
    .replace(pageExtensionsRegex, "");
  const apiPage = `${basePath}/${resource}`;

  const exports = Object.keys(parsed.queries).map((name) => {
    return `
      export function ${name}(arg, opts = {}) {
        const searchParams = new URLSearchParams(arg);
        searchParams.set('__query', ${JSON.stringify(name)});
        return useSWR(${JSON.stringify(
          apiPage
        )} + '?' + searchParams.toString(), {
          fetcher: (url) => fetch(url).then((res) => res.json()),
          ...opts,
        });
      }
    `;
  });

  const concat = new ConcatSource(
    source,
    `\n/**/;`,
    'import useSWR from "swr";',
    exports.join("\n\n")
  );

  this.callback(
    null,
    concat.source(),
    concat.map() ?? undefined,
    additionalData
  );
};

export default loader;
