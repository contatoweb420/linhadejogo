import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { archiveExternalIdSequence, matches, seasons, teams } from "./schema";

describe("restored OpenFootball archive schema", () => {
  it.each([[matches, "matches"], [seasons, "seasons"], [teams, "teams"]] as const)(
    "preserves nullable provider identity and a partial unique index for %s",
    (table, name) => {
      const column = getTableColumns(table).providerKey;
      expect(column.name).toBe("provider_key");
      expect(column.getSQLType()).toBe("text");
      expect(column.notNull).toBe(false);
      expect(column.hasDefault).toBe(false);
      const indexes = getTableConfig(table).indexes;
      const index = indexes.find(item => item.config.name === `${name}_source_provider_key`);
      expect(index?.config.unique).toBe(true);
      expect(index?.config.columns.map(column => "name" in column ? column.name : null))
        .toEqual(["source", "provider_key"]);
      expect(index?.config.where).toBeDefined();
    },
  );

  it("keeps archive identifiers independent of serial IDs", () => {
    expect(archiveExternalIdSequence.seqName).toBe("archive_external_id_seq");
    expect(archiveExternalIdSequence.seqOptions).toEqual({
      startWith: 900000001, increment: 1, cache: 1, cycle: false,
    });
    expect(matches.externalId.hasDefault).toBe(false);
  });
});
