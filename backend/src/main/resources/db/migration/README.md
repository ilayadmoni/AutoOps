# Flyway migrations

The backend applies migrations in version order at startup. Hibernate then validates entity mappings (`spring.jpa.hibernate.ddl-auto=validate`). PostgreSQL must provide the pgvector extension; use the deployment's `pgvector/pgvector:pg16` image or provision equivalent extension support.

- Never modify a migration already applied to a database; add the next unused `V<n>__<description>.sql` instead.
- Check the files in this directory for the current highest version rather than copying an old migration count from a README.
- The embedding column is `vector(384)`; changing dimensions requires coordinated schema/index and provider changes.
- Back up an existing database before deploying schema changes. A Flyway history/checksum error is not a reason to delete data or rewrite applied migrations.

See [schema overview](../../../../../../docs/DATABASE.md), [installation](../../../../../../docs/INSTALLATION.md) and [update/backup procedures](../../../../../../docs/DEPLOYMENT.md).
