# Migrations

Flyway migrations, applied in order at startup (`spring.jpa.hibernate.ddl-auto=validate` checks the entities).

- Never modify a migration that has been applied anywhere; add `V<n+1>__<description>.sql` instead.
  (V3 was corrected before it could ever apply: it re-added columns already created by V1 in the same commit.)
- Keep the embedding column at `vector(384)` unless all providers and the HNSW index are migrated together.
