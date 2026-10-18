# Folder packages

In **Files**, open the **Upload** menu and choose **Upload folder**. Review the
directory tree and mark any executable files, then choose **Upload package**.
The browser uploads regular files with their relative paths. Empty directories,
symlinks, original ownership and original permission metadata are not preserved.
Files default to `0644`; selected executable files use `0755`; directories use `0755`.

Each folder upload creates an immutable stored-file ID and a server-generated
`.tar.gz` archive, SHA-256 checksum and content manifest. Re-uploading a folder
creates a new version even when its contents are identical. Existing workflows
remain pinned to the selected version. Referenced packages cannot be deleted.
Download returns the archive. Ordinary file uploads retain their existing behavior.

## Workflow deployment

Use the existing **File transfer** step and select a folder package. The destination
is the exact directory to create on the target Linux machine; its parent must exist.
For example, package `app` with `config/app.conf` deployed to `/srv/backend` creates
`/srv/backend/config/app.conf`, without adding another `app` directory.

An existing destination is refused by default. **Replace directory** replaces the
whole directory, including removal of files absent from the package, and is HIGH
risk. The destination may not be a symlink or a regular file. Replacement requires
write access to the destination's parent (or the step's sudo option).

The target needs `tar`, `sha256sum` and standard Linux utilities (`mv -T` included).
Deployment uploads to a temporary file, verifies the archive checksum, locks the
destination against concurrent AutoOps deployments, extracts beside the destination,
and renames it into place. Replacement keeps a temporary backup and restores it if
installation fails before the new directory is placed. There is a short interval
between the two renames when the destination is absent; this is not a zero-downtime
release switch. Abrupt host/process termination can leave staging/backup/lock files
for an operator to inspect. Sufficient disk space is needed for the archive,
extracted package and previous destination during replacement.

## API and limits

- `GET /api/files/folders/limits`: configured byte limit and maximum 1000 files.
- `POST /api/files/folders`: multipart `manifest` JSON part with `name`, ordered
  `paths` and `executablePaths`, plus repeated `files` parts in matching order.
- `GET /api/files/{id}/manifest`: relative path, size, SHA-256 and executable flag.
- File list/get responses add `folderName` (null for ordinary files) and `fileCount`.
- Download/delete endpoints and `FILE_TRANSFER` workflow JSON remain unchanged.

The server rejects absolute paths, traversal, control characters, duplicate paths
and file/directory conflicts. It generates archives itself and does not extract
client-supplied archives. Raw file totals and archive size must fit `FILES_MAX_SIZE`
(default 100 MB); multipart request overhead also counts toward the request limit.
Tomcat accepts 1001 multipart parts to accommodate 1000 files plus the manifest.

## Release and rollback

Deploy backend and frontend together. Backend startup applies additive migration
`V22__folder_packages.sql`. Existing file rows keep null folder metadata and zero
file count. No existing storage objects or workflow records are rewritten.

Before reverting to an older backend, disable workflows referencing folder packages:
older versions would transfer the archive as an ordinary file. Retain the additive
columns and stored objects during rollback; do not drop package metadata. Re-deploying
the new backend restores folder semantics with the same immutable package IDs.

## Verification

Backend tests cover hierarchy, executable modes, path validation, upload limits,
version isolation, ordinary-file deduplication, storage cleanup, exact destinations,
checksum and extraction failures, destination locks, and replacement rollback.
Deployment shell tests run in disposable local directories, never a user's VM.
`frontend/scripts/folder-packages.browser.mjs` exercises EN/HE and mobile previews,
executable selection, multipart uploads, failure/retry, package trees, workflow
configuration, ordinary file uploads and client-side limits against mocked APIs.
