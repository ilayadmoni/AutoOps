package com.autoops.workflow.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "file_transfer_steps")
public class FileTransferStep extends WorkflowStep {
    @Column(name = "stored_file_id", nullable = false)
    private Long storedFileId;
    @Column(name = "destination_path", nullable = false)
    private String destinationPath;
    @Column(nullable = false)
    private boolean overwrite;
    @Column(name = "use_sudo", nullable = false)
    private boolean useSudo;
    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds = 300;

    public String type() { return "FILE_TRANSFER"; }

    public Long getStoredFileId() { return storedFileId; }
    public void setStoredFileId(Long v) { storedFileId = v; }
    public String getDestinationPath() { return destinationPath; }
    public void setDestinationPath(String v) { destinationPath = v; }
    public boolean isOverwrite() { return overwrite; }
    public void setOverwrite(boolean v) { overwrite = v; }
    public boolean isUseSudo() { return useSudo; }
    public void setUseSudo(boolean v) { useSudo = v; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer v) { timeoutSeconds = v; }
}
