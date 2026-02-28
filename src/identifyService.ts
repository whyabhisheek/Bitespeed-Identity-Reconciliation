import { all, run, ContactRow } from "./db";

type IdentifyRequest = {
  email?: string | null;
  phoneNumber?: string | number | null;
};

type IdentifyResponse = {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const asString = String(value).trim();
  return asString.length ? asString : null;
}

function sortByCreatedAt(a: ContactRow, b: ContactRow): number {
  const dateDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (dateDiff !== 0) return dateDiff;
  return a.id - b.id;
}

function uniqueInOrder(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildResponse(primary: ContactRow, cluster: ContactRow[]): IdentifyResponse {
  const ordered = [...cluster].sort(sortByCreatedAt);

  return {
    contact: {
      primaryContatctId: primary.id,
      emails: uniqueInOrder([primary.email, ...ordered.filter((c) => c.id !== primary.id).map((c) => c.email)]),
      phoneNumbers: uniqueInOrder([primary.phoneNumber, ...ordered.filter((c) => c.id !== primary.id).map((c) => c.phoneNumber)]),
      secondaryContactIds: ordered.filter((c) => c.id !== primary.id).map((c) => c.id)
    }
  };
}

function chooseCanonicalPrimary(contacts: ContactRow[]): ContactRow {
  const primaries = contacts.filter((c) => c.linkPrecedence === "primary").sort(sortByCreatedAt);
  return primaries[0];
}

async function fetchClusterByPrimary(primaryId: number): Promise<ContactRow[]> {
  return all<ContactRow>(
    "SELECT * FROM Contact WHERE id = ? OR linkedId = ? ORDER BY datetime(createdAt) ASC, id ASC",
    [primaryId, primaryId]
  );
}

export async function identifyContact(input: IdentifyRequest): Promise<IdentifyResponse> {
  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhone(input.phoneNumber);

  if (!email && !phoneNumber) {
    throw new Error("Either email or phoneNumber is required");
  }

  const whereParts: string[] = [];
  const whereValues: Array<string | number | null> = [];

  if (email) {
    whereParts.push("email = ?");
    whereValues.push(email);
  }
  if (phoneNumber) {
    whereParts.push("phoneNumber = ?");
    whereValues.push(phoneNumber);
  }

  const initialMatches = await all<ContactRow>(
    `SELECT * FROM Contact WHERE ${whereParts.join(" OR ")} ORDER BY datetime(createdAt) ASC, id ASC`,
    whereValues
  );

  if (initialMatches.length === 0) {
    const inserted = await run(
      "INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) VALUES (?, ?, NULL, 'primary', datetime('now'), datetime('now'), NULL)",
      [phoneNumber, email]
    );
    const created = await all<ContactRow>("SELECT * FROM Contact WHERE id = ?", [inserted.lastID]);
    return buildResponse(created[0], created);
  }

  const relatedPrimaryIds = new Set<number>();
  for (const row of initialMatches) {
    if (row.linkPrecedence === "primary") relatedPrimaryIds.add(row.id);
    if (row.linkPrecedence === "secondary" && row.linkedId) relatedPrimaryIds.add(row.linkedId);
  }

  const idList = [...relatedPrimaryIds];
  const placeholders = idList.map(() => "?").join(",");

  const primariesAndSecondaries = await all<ContactRow>(
    `SELECT * FROM Contact WHERE id IN (${placeholders}) OR linkedId IN (${placeholders}) ORDER BY datetime(createdAt) ASC, id ASC`,
    [...idList, ...idList]
  );

  const canonical = chooseCanonicalPrimary(primariesAndSecondaries);

  const demotedPrimaryIds = primariesAndSecondaries
    .filter((c) => c.linkPrecedence === "primary" && c.id !== canonical.id)
    .map((c) => c.id);

  if (demotedPrimaryIds.length > 0) {
    const demotePlaceholders = demotedPrimaryIds.map(() => "?").join(",");

    await run(
      `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = datetime('now') WHERE id IN (${demotePlaceholders})`,
      [canonical.id, ...demotedPrimaryIds]
    );

    await run(
      `UPDATE Contact SET linkedId = ?, updatedAt = datetime('now') WHERE linkedId IN (${demotePlaceholders})`,
      [canonical.id, ...demotedPrimaryIds]
    );
  }

  let cluster = await fetchClusterByPrimary(canonical.id);

  const existingEmails = new Set(cluster.map((c) => c.email).filter(Boolean) as string[]);
  const existingPhones = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean) as string[]);

  const addsNewInfo = Boolean((email && !existingEmails.has(email)) || (phoneNumber && !existingPhones.has(phoneNumber)));

  if (addsNewInfo) {
    await run(
      "INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, 'secondary', datetime('now'), datetime('now'), NULL)",
      [phoneNumber, email, canonical.id]
    );
    cluster = await fetchClusterByPrimary(canonical.id);
  }

  const primary = cluster.find((c) => c.id === canonical.id);
  if (!primary) {
    throw new Error("Primary contact not found after reconciliation");
  }

  return buildResponse(primary, cluster);
}
