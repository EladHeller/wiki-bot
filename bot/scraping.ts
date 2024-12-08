type SchamaJson = Record<string, any>;
const possibleProblem = /"video":\s*,/;
export function getSchemaData(doc: Document, type: string): SchamaJson | undefined {
  const schemas = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  if (schemas.length === 0) {
    return undefined;
  }

  return schemas
    .flatMap((schema) => {
      try {
        const schemaData = JSON.parse(schema.textContent?.replace(possibleProblem, '').trim() ?? '');
        if (schemaData['@graph']) {
          return schemaData['@graph'];
        }
        return JSON.parse(schema.textContent?.replace(possibleProblem, '').trim() ?? '');
      } catch {
        console.warn('Invalid schema', schema.textContent);
        return undefined;
      }
    })
    .find((schemaData) => schemaData?.['@type'] === type);
}

export function getMetaValue(doc: Document, propertyOrName: string): string | null {
  const meta = doc.querySelector(`meta[${propertyOrName}]`);
  return meta?.getAttribute('content') ?? null;
}

export function getAttr(doc: Document, selector: string, attr: string): string | null {
  const element = doc.querySelector(selector);
  return element?.getAttribute(attr) ?? null;
}

export function getContent(doc: Document, selector: string): string | null {
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    if (element.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  return null;
}
