package com.autoops.workflow.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Runs an approved Command Bank entry. Sudo is execution metadata, never part of the stored template. */
@Entity
@Table(name = "command_steps")
public class CommandStep extends WorkflowStep {
    @Column(name = "command_definition_id")
    private Long commandDefinitionId;
    /** Snapshot for display only; execution always resolves the current approved definition. */
    @Column(name = "command_template", columnDefinition = "text")
    private String commandTemplate;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    private String parameters;
    @Column(name = "run_with_sudo", nullable = false)
    private boolean runWithSudo;
    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds = 300;

    public String type() { return "COMMAND"; }

    public Long getCommandDefinitionId() { return commandDefinitionId; }
    public void setCommandDefinitionId(Long v) { commandDefinitionId = v; }
    public String getCommandTemplate() { return commandTemplate; }
    public void setCommandTemplate(String v) { commandTemplate = v; }
    public String getParameters() { return parameters; }
    public void setParameters(String v) { parameters = v; }
    public boolean isRunWithSudo() { return runWithSudo; }
    public void setRunWithSudo(boolean v) { runWithSudo = v; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer v) { timeoutSeconds = v; }
}
