package com.autoops.machine.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "machine_folders")
public class MachineFolder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false, unique = true, length = 1000)
    private String path;
    @Column(name = "parent_id")
    private Long parentId;

    public MachineFolder() {}
    public MachineFolder(String name, String path, Long parentId) {
        this.name = name;
        this.path = path;
        this.parentId = parentId;
    }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getPath() { return path; }
    public Long getParentId() { return parentId; }
}
