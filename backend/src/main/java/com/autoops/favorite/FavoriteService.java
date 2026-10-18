package com.autoops.favorite;

import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class FavoriteService {
    private static final Map<String, String> TABLES = Map.of(
            "workflows", "workflows", "commands", "command_definitions", "credentials", "credentials",
            "files", "stored_files", "machines", "machines", "machine-folders", "machine_folders");
    private final JdbcTemplate jdbc;

    public FavoriteService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<Long> list(AuthenticatedUser user, String collection) {
        String table = table(collection);
        return jdbc.queryForList("SELECT f.item_id FROM user_favorites f JOIN " + table
                + " i ON i.id = f.item_id WHERE f.user_id = ? AND f.collection = ?"
                + visibility(collection, user) + " ORDER BY f.item_id", Long.class, user.id(), collection);
    }

    @Transactional
    public void add(AuthenticatedUser user, String collection, Long id) {
        String table = table(collection);
        Integer count = jdbc.queryForObject("SELECT count(*) FROM " + table + " i WHERE i.id = ?"
                + visibility(collection, user), Integer.class, id);
        if (count == null || count == 0) throw ApiException.notFound("Item");
        jdbc.update("INSERT INTO user_favorites(user_id, collection, item_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                user.id(), collection, id);
    }

    @Transactional
    public void remove(AuthenticatedUser user, String collection, Long id) {
        table(collection);
        jdbc.update("DELETE FROM user_favorites WHERE user_id = ? AND collection = ? AND item_id = ?",
                user.id(), collection, id);
    }

    private static String table(String collection) {
        String table = TABLES.get(collection);
        if (table == null) throw ApiException.badRequest("INVALID_COLLECTION", "Unknown favorites collection");
        return table;
    }

    private static String visibility(String collection, AuthenticatedUser user) {
        if (collection.equals("machine-folders")) return "";
        if (!collection.equals("commands")) return " AND i.deleted_at IS NULL";
        return user.isAdmin() ? "" : " AND (i.status = 'APPROVED' OR i.created_by = " + user.id() + ")";
    }
}
