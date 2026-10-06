package com.autoops.user.controller;

import com.autoops.user.dto.UserDtos;
import com.autoops.user.service.UserAdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {
    private final UserAdminService service;

    public UserAdminController(UserAdminService service) {
        this.service = service;
    }

    @GetMapping
    public List<UserDtos.UserView> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDtos.UserView create(@Valid @RequestBody UserDtos.CreateUser r) {
        return service.create(r);
    }

    @PatchMapping("/{id}/status")
    public UserDtos.UserView status(@PathVariable Long id, @Valid @RequestBody UserDtos.UpdateStatus r) {
        return service.status(id, r.status());
    }

    @PatchMapping("/{id}/role")
    public UserDtos.UserView role(@PathVariable Long id, @Valid @RequestBody UserDtos.UpdateRole r) {
        return service.role(id, r.role());
    }

    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@PathVariable Long id, @Valid @RequestBody UserDtos.ResetPassword r) {
        service.resetPassword(id, r.password());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
