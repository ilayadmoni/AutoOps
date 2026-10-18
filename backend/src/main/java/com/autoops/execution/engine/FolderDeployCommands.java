package com.autoops.execution.engine;

import com.autoops.infrastructure.remote.ShellCommands;

/** Only server-created, validated archives reach this script. All paths are quoted as data. */
final class FolderDeployCommands {
    static String deploy(String archive, String destination, String checksum, boolean replace, String nonce) {
        String parent = destination.substring(0, destination.lastIndexOf('/'));
        if (parent.isEmpty()) parent = "/";
        return "archive=" + ShellCommands.quote(archive) + "\ndest=" + ShellCommands.quote(destination)
                + "\nparent=" + ShellCommands.quote(parent) + "\nexpected=" + ShellCommands.quote(checksum)
                + "\nreplace=" + (replace ? "yes" : "no") + "\nnonce=" + ShellCommands.quote(nonce) + "\n" + """
                set -eu
                umask 022
                command -v tar >/dev/null || { echo 'tar is required' >&2; exit 1; }
                actual=$(sha256sum -- "$archive")
                [ "${actual%% *}" = "$expected" ] || { echo 'Package checksum mismatch' >&2; exit 1; }
                [ -d "$parent" ] || { echo 'Destination parent directory does not exist' >&2; exit 1; }
                [ ! -L "$dest" ] || { echo 'Destination must not be a symlink' >&2; exit 1; }
                [ ! -e "$dest" ] || [ -d "$dest" ] || { echo 'Destination is not a directory' >&2; exit 1; }
                if [ -e "$dest" ] && [ "$replace" != yes ]; then
                  echo 'Destination exists; Replace directory is disabled. Choose a new folder path including the original folder name under a writable parent.' >&2; exit 1
                fi
                [ -w "$parent" ] && [ -x "$parent" ] || { echo 'Permission denied: destination parent directory is not writable/searchable; choose your SSH user home directory or enable sudo if authorized' >&2; exit 1; }
                lock="${dest}.autoops-lock"
                if ! mkdir -- "$lock"; then
                  if [ -d "$lock" ]; then echo 'Destination is locked by another deployment' >&2;
                  else echo 'Cannot create deployment lock; check destination parent permissions' >&2; fi
                  exit 1
                fi
                stage="$parent/.autoops-stage-$nonce"
                backup="$parent/.autoops-backup-$nonce"
                stage_owned=no
                backup_owned=no
                cleanup() {
                  status=$?
                  trap - EXIT HUP INT TERM
                  if [ "$backup_owned" = yes ] && [ ! -e "$dest" ] && [ ! -L "$dest" ]; then mv -T -- "$backup" "$dest" || true; fi
                  if [ "$stage_owned" = yes ]; then rm -rf -- "$stage"; fi
                  rmdir -- "$lock" || true
                  exit "$status"
                }
                trap cleanup EXIT
                trap 'exit 130' HUP INT TERM
                [ ! -e "$stage" ] && [ ! -L "$stage" ] && [ ! -e "$backup" ] && [ ! -L "$backup" ] || exit 1
                if [ -e "$dest" ] && [ "$replace" != yes ]; then echo 'Destination exists; Replace directory is disabled' >&2; exit 1; fi
                [ ! -L "$dest" ] || exit 1
                mkdir -- "$stage"
                stage_owned=yes
                tar --no-same-owner -xzf "$archive" -C "$stage"
                chmod 755 -- "$stage"
                if [ -e "$dest" ]; then mv -T -- "$dest" "$backup"; backup_owned=yes; fi
                mv -T -- "$stage" "$dest"
                if [ -d "$backup" ]; then rm -rf -- "$backup"; fi
                echo "Folder deployed to $dest; SHA-256 verified: $expected"
                """;
    }
}
