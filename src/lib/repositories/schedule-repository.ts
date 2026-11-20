import { getFirebaseFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirestoreScheduleRepository } from "@/lib/repositories/firestore-repository";
import { createLocalMockScheduleRepository } from "@/lib/repositories/local-mock-repository";
import type { ScheduleRepository } from "@/lib/repositories/types";

let cachedFirestoreRepo: ScheduleRepository | null = null;
let cachedMockRepo: ScheduleRepository | null = null;

export function getRepositoryMode(): "firebase" | "mock" {
  return isFirebaseConfigured() ? "firebase" : "mock";
}

/**
 * Mengembalikan driver repository aktif (Cloud Firestore bila dikonfigurasi, atau Local Mock fallback).
 */
export function getScheduleRepository(): ScheduleRepository {
  if (isFirebaseConfigured()) {
    const db = getFirebaseFirestore();
    if (db) {
      if (!cachedFirestoreRepo) {
        cachedFirestoreRepo = new FirestoreScheduleRepository(db);
      }
      return cachedFirestoreRepo;
    }
  }

  if (!cachedMockRepo) {
    cachedMockRepo = createLocalMockScheduleRepository();
  }
  return cachedMockRepo;
}

export * from "@/lib/repositories/types";
export {
  createLocalMockScheduleRepository,
  clearLocalMockDatabase,
} from "@/lib/repositories/local-mock-repository";
export { FirestoreScheduleRepository } from "@/lib/repositories/firestore-repository";
