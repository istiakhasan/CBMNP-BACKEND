export function extractOptions(query: Record<string, any>, keys: string[]): Record<string, any> {
    const options: Record<string, any> = {};
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    return options;
  }
  