package com.autoops.favorite;

import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FavoriteServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final FavoriteService service = new FavoriteService(jdbc);
    private final AuthenticatedUser user = new AuthenticatedUser(7L, "operator", "USER");

    @Test void listsOnlyTheCurrentUsersFavoritesAndExcludesDeletedItemsForEveryTab() {
        for (String tab : List.of("workflows", "credentials", "files", "machines")) {
            when(jdbc.queryForList(anyString(), eq(Long.class), eq(7L), eq(tab))).thenReturn(List.of(9L));
            assertEquals(List.of(9L), service.list(user, tab));
        }
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(4)).queryForList(sql.capture(), eq(Long.class), eq(7L), anyString());
        sql.getAllValues().forEach(query -> {
            assertTrue(query.contains("f.user_id = ? AND f.collection = ?"));
            assertTrue(query.contains("i.deleted_at IS NULL"));
        });
    }

    @Test void commandFavoritesRespectVisibilityAndAdminAccess() {
        service.list(user, "commands");
        service.list(new AuthenticatedUser(8L, "admin", "ADMIN"), "commands");
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), eq(Long.class), eq(7L), eq("commands"));
        assertTrue(sql.getValue().contains("i.status = 'APPROVED' OR i.created_by = 7"));
        verify(jdbc).queryForList(sql.capture(), eq(Long.class), eq(8L), eq("commands"));
        assertFalse(sql.getValue().contains("i.status"));
    }

    @Test void foldersHaveSeparatePerUserFavoritesAndDoNotUseSoftDeleteColumns() {
        service.list(user, "machine-folders");
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), eq(Long.class), eq(7L), eq("machine-folders"));
        assertTrue(sql.getValue().contains("JOIN machine_folders i"));
        assertFalse(sql.getValue().contains("deleted_at"));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(9L))).thenReturn(1);
        service.add(user, "machine-folders", 9L);
        verify(jdbc).update(contains("ON CONFLICT DO NOTHING"), eq(7L), eq("machine-folders"), eq(9L));
        service.remove(user, "machine-folders", 9L);
        verify(jdbc).update(startsWith("DELETE FROM user_favorites WHERE user_id = ?"), eq(7L), eq("machine-folders"), eq(9L));
    }

    @Test void addingValidatesExistenceAndIsIdempotent() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(9L))).thenReturn(1);
        service.add(user, "files", 9L);
        verify(jdbc).update(contains("ON CONFLICT DO NOTHING"), eq(7L), eq("files"), eq(9L));
    }

    @Test void unavailableItemsCannotBeFavorited() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(9L))).thenReturn(0);
        assertThrows(ApiException.class, () -> service.add(user, "files", 9L));
        verify(jdbc, never()).update(anyString(), any(), any(), any());
    }

    @Test void removingCannotChangeAnotherUsersFavorites() {
        service.remove(user, "files", 9L);
        verify(jdbc).update("DELETE FROM user_favorites WHERE user_id = ? AND collection = ? AND item_id = ?", 7L, "files", 9L);
    }

    @Test void rejectsUnknownCollectionsBeforeDatabaseAccess() {
        assertThrows(ApiException.class, () -> service.list(user, "users"));
        assertThrows(ApiException.class, () -> service.add(user, "files;DROP TABLE users", 1L));
        assertThrows(ApiException.class, () -> service.remove(user, "users", 1L));
        verifyNoInteractions(jdbc);
    }
}
