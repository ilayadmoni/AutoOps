package com.autoops.workflow.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Polls a condition with a bounded loop. OUTPUT_CONTAINS / EXIT_CODE run an approved read-only command; FILE_EXISTS
 * and SERVICE_ACTIVE use fixed server-built checks on {@code target}.
 */
@Entity
@Table(name = "wait_until_steps")
public class WaitUntilStep extends WorkflowStep {
    @Column(name = "check_type", nullable = false)
    private String checkType;
    @Column(name = "command_definition_id")
    private Long commandDefinitionId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    private String parameters;
    @Column(name = "expected_output")
    private String expectedOutput;
    @Column(name = "expected_exit_code")
    private Integer expectedExitCode;
    @Column(name = "target", columnDefinition = "text")
    private String target;
    @Column(name = "run_with_sudo", nullable = false)
    private boolean runWithSudo;
    @Column(name = "check_interval_seconds", nullable = false)
    private Integer checkIntervalSeconds = 5;
    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds = 120;

    public String type() { return "WAIT_UNTIL"; }

    public String getCheckType() { return checkType; }
    public void setCheckType(String v) { checkType = v; }
    public Long getCommandDefinitionId() { return commandDefinitionId; }
    public void setCommandDefinitionId(Long v) { commandDefinitionId = v; }
    public String getParameters() { return parameters; }
    public void setParameters(String v) { parameters = v; }
    public String getExpectedOutput() { return expectedOutput; }
    public void setExpectedOutput(String v) { expectedOutput = v; }
    public Integer getExpectedExitCode() { return expectedExitCode; }
    public void setExpectedExitCode(Integer v) { expectedExitCode = v; }
    public String getTarget() { return target; }
    public void setTarget(String v) { target = v; }
    public boolean isRunWithSudo() { return runWithSudo; }
    public void setRunWithSudo(boolean v) { runWithSudo = v; }
    public Integer getCheckIntervalSeconds() { return checkIntervalSeconds; }
    public void setCheckIntervalSeconds(Integer v) { checkIntervalSeconds = v; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer v) { timeoutSeconds = v; }
}
