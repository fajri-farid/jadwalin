import { describe, expect, it } from "vitest";
import { getAuthMode } from "@/lib/firebase/auth";
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseConfig,
  getFirebaseFirestore,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { getRepositoryMode } from "@/lib/repositories/schedule-repository";

describe("Firebase Client Config & Mode Detection", () => {
  it("menganggap unconfigured jika ada field wajib yang kosong atau spasi saja", () => {
    expect(
      isFirebaseConfigured({
        apiKey: "",
        authDomain: "jadwalin.firebaseapp.com",
        projectId: "jadwalin-id",
        storageBucket: "jadwalin-id.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123456:web:abc",
      })
    ).toBe(false);

    expect(
      isFirebaseConfigured({
        apiKey: "   ",
        authDomain: "jadwalin.firebaseapp.com",
        projectId: "jadwalin-id",
        storageBucket: "jadwalin-id.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123456:web:abc",
      })
    ).toBe(false);
  });

  it("menganggap configured saat keenam field publik Firebase terisi", () => {
    expect(
      isFirebaseConfigured({
        apiKey: "AIza-public-key",
        authDomain: "jadwalin.firebaseapp.com",
        projectId: "jadwalin-id",
        storageBucket: "jadwalin-id.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123456:web:abc",
      })
    ).toBe(true);
  });

  it("mengembalikan getter null dan mode mock secara aman saat env belum diisi", () => {
    const config = getFirebaseConfig();
    expect(isFirebaseConfigured(config)).toBe(false);
    expect(getFirebaseApp()).toBeNull();
    expect(getFirebaseAuth()).toBeNull();
    expect(getFirebaseFirestore()).toBeNull();
    expect(getAuthMode()).toBe("mock");
    expect(getRepositoryMode()).toBe("mock");
  });
});
