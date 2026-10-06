package com.autoops.execution.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "preflight_runs")
public class PreflightRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "machine_run_id", nullable = false)
    private Long machineRunId;
    @Column(nullable = false)
    private String status = ExecutionStatus.PENDING;
    @Column(name = "ssh_status")
    private String sshStatus;
    @Column(name = "authentication_status")
    private String authenticationStatus;
    @Column(name = "host_verification_status")
    private String hostVerificationStatus;
    @Column(name = "os_status")
    private String osStatus;
    @Column(name = "sudo_status")
    private String sudoStatus;
    @Column(name = "files_status")
    private String filesStatus;
    @Column(name = "parameters_status")
    private String parametersStatus;
    @Column(name = "failure_reason", columnDefinition = "text")
    private String failureReason;
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    public Long getId() { return id; }
    public Long getMachineRunId() { return machineRunId; }
    public void setMachineRunId(Long v) { machineRunId = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getSshStatus() { return sshStatus; }
    public void setSshStatus(String v) { sshStatus = v; }
    public String getAuthenticationStatus() { return authenticationStatus; }
    public void setAuthenticationStatus(String v) { authenticationStatus = v; }
    public String getHostVerificationStatus() { return hostVerificationStatus; }
    public void setHostVerificationStatus(String v) { hostVerificationStatus = v; }
    public String getOsStatus() { return osStatus; }
    public void setOsStatus(String v) { osStatus = v; }
    public String getSudoStatus() { return sudoStatus; }
    public void setSudoStatus(String v) { sudoStatus = v; }
    public String getFilesStatus() { return filesStatus; }
    public void setFilesStatus(String v) { filesStatus = v; }
    public String getParametersStatus() { return parametersStatus; }
    public void setParametersStatus(String v) { parametersStatus = v; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String v) { failureReason = v; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { finishedAt = v; }
}
