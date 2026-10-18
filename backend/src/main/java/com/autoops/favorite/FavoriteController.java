package com.autoops.favorite;

import com.autoops.common.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/favorites/{collection}")
public class FavoriteController {
    private final FavoriteService service;
    private final CurrentUser current;

    public FavoriteController(FavoriteService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping
    public List<Long> list(@PathVariable String collection) {
        return service.list(current.get(), collection);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@PathVariable String collection, @PathVariable Long id) {
        service.add(current.get(), collection, id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable String collection, @PathVariable Long id) {
        service.remove(current.get(), collection, id);
    }
}
