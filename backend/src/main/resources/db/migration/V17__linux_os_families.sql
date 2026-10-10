-- Commands now declare the Linux distribution families they support (LINUX = any). Everything was stored as RHEL
-- before, so re-tag by tool: family-specific package/firewall/SELinux tools keep their family, the rest run anywhere.
UPDATE command_definitions
SET supported_os = CASE
    WHEN command_template ~ '^\s*(dnf|yum|rpm|firewall-cmd|getenforce|setenforce|sestatus|semanage|restorecon|subscription-manager)(\s|$)' THEN 'RHEL'
    WHEN command_template ~ '^\s*(apt|apt-get|apt-cache|dpkg|ufw)(\s|$)' THEN 'DEBIAN'
    WHEN command_template ~ '^\s*zypper(\s|$)' THEN 'SUSE'
    WHEN command_template ~ '^\s*pacman(\s|$)' THEN 'ARCH'
    WHEN command_template ~ '^\s*apk(\s|$)' THEN 'ALPINE'
    ELSE 'LINUX'
END
WHERE supported_os IS NULL OR supported_os = 'RHEL';
