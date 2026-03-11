import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";

const READINGS_COLLECTION = "iaq_readings";
const USERS_COLLECTION = "users";

export async function addSampleReading() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured yet.");
  }

  const payload = {
    room: "Meeting Room A",
    co2: 612,
    temperature: 24.6,
    humidity: 53,
    createdAt: serverTimestamp(),
  };

  return addDoc(collection(db, READINGS_COLLECTION), payload);
}

export async function getLatestReadings() {
  if (!isFirebaseConfigured) {
    return [];
  }

  const readingsQuery = query(
    collection(db, READINGS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(5)
  );

  const snapshot = await getDocs(readingsQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function upsertUserProfile(user) {
  if (!isFirebaseConfigured || !user?.email) {
    return;
  }

  const userRef = doc(db, USERS_COLLECTION, user.id ?? user.email);

  await setDoc(
    userRef,
    {
      name: user.name ?? "",
      email: user.email,
      username: user.username ?? "",
      phone: user.phone ?? "",
      avatarUrl: user.avatar_url ?? "",
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}
