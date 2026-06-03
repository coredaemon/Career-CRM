export function listKeyByIndex(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

export function listKeyById(id: string) {
  return id;
}
