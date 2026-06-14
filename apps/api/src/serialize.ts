import type { HydratedDocument } from "mongoose";

export function toId(value: unknown) {
  return value?.toString?.() ?? String(value);
}

export function serializeDoc<T extends Record<string, any>>(doc: HydratedDocument<T> | T) {
  const raw = typeof (doc as any).toObject === "function" ? (doc as any).toObject() : doc;
  const { _id, __v, ...rest } = raw;
  return { id: toId(_id), ...rest };
}

export function serializeMany<T extends Record<string, any>>(docs: Array<HydratedDocument<T> | T>) {
  return docs.map((doc) => serializeDoc(doc));
}
