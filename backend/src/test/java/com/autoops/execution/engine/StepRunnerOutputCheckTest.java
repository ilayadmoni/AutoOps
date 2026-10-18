package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.infrastructure.remote.ExecResult;
import com.autoops.infrastructure.remote.OsFamily;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineConnectionService;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Verifies polling command semantics without connecting to or executing commands on a user's VM. */
class StepRunnerOutputCheckTest {
    private static final String READY = "backend is ready";

    @Test
    void finiteLogSnapshotMatchesAndContinuesImmediately() {
        var result = run("docker logs --tail 200 backend 2>&1", READY,
                new ExecResult(0, "Starting\n" + READY + "\n", "", false, false));

        assertThat(result.status()).isEqualTo(ExecutionStatus.SUCCESS);
        assertThat(result.stdout()).contains(READY);
        assertThat(result.failureReason()).isNull();
    }

    @Test
    void followingLogsFailsAfterTimeoutEvenWhenTheExpectedStringWasPrinted() {
        var result = run("docker logs backend -f | grep 'ready'", READY,
                new ExecResult(-1, READY + "\n", "", true, false));

        assertThat(result.status()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(result.stdout()).contains(READY);
        assertThat(result.failureReason()).contains("Condition OUTPUT_CONTAINS not met");
    }

    @Test
    void textOnStderrOnlyDoesNotMatchButMergingStreamsDoes() {
        var stderrOnly = run("docker logs --tail 200 backend", READY,
                new ExecResult(0, "", READY, false, false));
        var merged = run("docker logs --tail 200 backend 2>&1", READY,
                new ExecResult(0, READY, "", false, false));

        assertThat(stderrOnly.status()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(stderrOnly.stderr()).isEqualTo(READY);
        assertThat(merged.status()).isEqualTo(ExecutionStatus.SUCCESS);
    }

    @Test
    void bannerMatchingIsLiteralIncludingSpacesAndLineBreaks() {
        String banner = "  ___  ___\n / _ \\/ _ \\\n";
        var output = new ExecResult(0, banner, "", false, false);

        assertThat(StepRunner.matches(definition("  ___  ___"), output)).isTrue();
        assertThat(StepRunner.matches(definition(banner), output)).isTrue();
        assertThat(StepRunner.matches(definition(banner.replace("\n", "")), output)).isFalse();
        assertThat(StepRunner.matches(definition("___ ___"), output)).isFalse();
        assertThat(StepRunner.matches(definition("APP IS READY"), output)).isFalse();
    }

    @Test
    void plainTextMatchingIsCaseSensitiveAndDoesNotInterpretRegex() {
        var output = new ExecResult(0, READY, "", false, false);
        assertThat(StepRunner.matches(definition(READY), output)).isTrue();
        assertThat(StepRunner.matches(definition("Backend is ready"), output)).isFalse();
        assertThat(StepRunner.matches(definition("backend.*ready"), output)).isFalse();
    }

    @Test
    void incompleteOrEmptyOutputDoesNotMatch() {
        assertThat(StepRunner.matches(definition(READY), new ExecResult(0, "backend is", "", false, false))).isFalse();
        assertThat(StepRunner.matches(definition(READY), new ExecResult(0, "", "", false, false))).isFalse();
        assertThat(StepRunner.matches(definition(READY), new ExecResult(0, null, "", false, false))).isFalse();
    }

    private static StepDefinition.WaitUntil definition(String expected) {
        return new StepDefinition.WaitUntil("OUTPUT_CONTAINS", 1L, Map.of(), expected, null, null, false, 1, 1);
    }

    private static StepResult run(String command, String expected, ExecResult output) {
        var connections = mock(MachineConnectionService.class);
        var session = mock(RemoteSession.class);
        var machine = new Machine();
        var credential = new Credential();
        var step = new PlanStep("s3", 3L, "Check backend ready", false, definition(expected), null, null);
        var resolved = new ResolvedStep(step, "WAIT_UNTIL", command, command, "LOW", false, 1, null, null, Set.of(OsFamily.LINUX));
        when(connections.connect(machine, credential)).thenReturn(session);
        when(session.exec(eq(command), isNull(), anyInt(), any(), isNull())).thenReturn(output);

        var result = new StepRunner(connections, null, null).run(machine, credential, resolved, () -> false, null);

        verify(session, atLeastOnce()).exec(eq(command), isNull(), anyInt(), any(), isNull());
        verify(session).close();
        return result;
    }
}
