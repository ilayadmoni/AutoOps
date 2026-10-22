package com.autoops.machine.service;

import org.springframework.jdbc.core.JdbcTemplate;

/** Shared with imports so folder paths cannot change midway through a row transaction. */
final class MachineFolderLock {
    static final String SQL = "select 1 from pg_advisory_xact_lock(728341902)";
    private MachineFolderLock() {}
    static void acquire(JdbcTemplate jdbc) { jdbc.execute(SQL); }
}
